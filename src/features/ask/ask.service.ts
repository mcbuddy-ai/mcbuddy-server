import { Either, tryCatch as eitherTryCatch, isRight, left, right } from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { chain, fromEither, map, TaskEither, tryCatch } from 'fp-ts/TaskEither';
import { request } from '../../infrastructure/providers/openrouter/openrouter.client';
import { AIMessage } from '../../infrastructure/providers/openrouter/openrouter.types';
import { policies, retry } from '../../shared/lib/retry';
import { logger } from '../../shared/logging/logger';
import { API_ERRORS, ApiError, apierror } from '../../shared/types/errors';
import { AskResponse, Message } from './ask.types';
import { redis } from 'bun';
import { SYSTEM_MESSAGE_WITH_CONTEXT } from './ask.env';

export const ask = (userId: string, question: string, platform: string = 'unknown'): TaskEither<ApiError, AskResponse> => {
  logger.info(`Processing AI completion for user: ${userId}, platform: ${platform}`);
  return pipe(
    fromEither(check(question)),
    chain(question => fetchAndBuild(userId, question)),
    chain(messages =>
      retry(
        `AI completion for user ${userId}`,
        policies.standard,
        request(messages, platform)
      )
    ),
    map(format)
  );
};

const check = (question: string) => {
  const trimmedQuestion = question.trim();
  if (trimmedQuestion.length === 0) return left(apierror(API_ERRORS.EMPTY_QUESTION));
  if (trimmedQuestion.length > 1000) return left(apierror(API_ERRORS.QUESTION_TOO_LONG));
  return right(trimmedQuestion);
};

const format = (response: string) => ({ response: response.trim() });

const parseMsg = (msg: string): Either<ApiError, Message> =>
  eitherTryCatch(
    () => {
      const parsed = JSON.parse(msg);
      if (!parsed.role || !parsed.content || (parsed.role !== 'user' && parsed.role !== 'assistant') || typeof parsed.content !== 'string') {
        throw new Error('Invalid message format');
      }
      return { role: parsed.role, content: parsed.content };
    },
    (error) => apierror(API_ERRORS.PARSE_ERROR, `Invalid Redis message: ${String(error)}`)
  );

const parseMsgs = (messages: string[]) => messages.map(parseMsg).filter(isRight).map(either => either.right).reverse();

const toAIMsg = (msg: Message): AIMessage => ({ role: msg.role, content: msg.content });

const limitCtx = (messages: AIMessage[], maxContextMessages: number) => {
  if (messages.length <= maxContextMessages + 2) return messages;
  const systemMessage = messages[0];
  return [systemMessage, ...messages.slice(-(maxContextMessages + 1))];
};

const fetch = (userId: string) => {
  const key = `chat_history:${userId}`;
  return retry(
    `Redis LRANGE for user ${userId}`,
    policies.critical,
    tryCatch(
      () => redis.send("LRANGE", [key, "0", "24"]) as Promise<string[]>,
      (error) => apierror(API_ERRORS.REDIS_ERROR, String(error))
    )
  );
};

const history = (redisMessages: string[]) => {
  if (!redisMessages || redisMessages.length === 0) return [];
  return parseMsgs(redisMessages);
};

const systemMsg = (): AIMessage => ({
  role: 'system',
  content: SYSTEM_MESSAGE_WITH_CONTEXT
});

const msgs = (chatHistory: Message[], question: string) => {
  const systemMessage = systemMsg();
  const historyMessages = chatHistory.map(toAIMsg);
  const userMessage: AIMessage = { role: 'user', content: question };
  return [systemMessage, ...historyMessages, userMessage];
};

const fetchAndBuild = (userId: string, question: string) => {
  logger.info(`Building message history for user: ${userId}`);
  return pipe(
    fetch(userId),
    map(history),
    map((history: Message[]) => msgs(history, question)),
    map((messages: AIMessage[]) => limitCtx(messages, 25))
  );
};

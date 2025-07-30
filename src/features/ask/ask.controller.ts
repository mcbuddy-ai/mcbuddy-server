import { redis } from 'bun';
import * as E from 'fp-ts/Either';
import { flow, pipe } from 'fp-ts/function';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { TaskEither, tryCatch } from 'fp-ts/TaskEither';
import { policies, retry } from '../../shared/lib/retry';
import { logger } from "../../shared/logging/logger";
import { API_ERRORS, apierror, ApiError } from "../../shared/types/errors";
import { addJob, waitForJobResult, AskJobData } from "../../infrastructure/queues";
import { AskRequest, AskResponse, Message } from "./ask.types";
import { MAX_MESSAGES, CHAT_TTL_SECONDS } from "./ask.env";

export const handleAsk = (req: Request) => {
  const token = req.headers.get('X-OpenRouter-Token') || undefined;
  
  return pipe(
    req,
    TE.fromEitherK(check),
    TE.chain(parse),
    TE.chainEitherK(validate),
    TE.bindTo('body'),
    TE.bind('token', () => TE.right(token)),
    TE.chainFirst(saveUserMessage),
    TE.bind('aiResult', processWithQueue),
    TE.chainFirst(saveAssistantMessage),
    TE.map(createSuccessResponse),
    TE.getOrElse(e => T.of(error(e)))
  )();
}

const getUserId = (body: AskRequest): string => body.user_id || "anonymous";
const getPlatform = (body: AskRequest): string => body.platform || 'unknown';
const saveUserMessage = ({ body }: { body: AskRequest }) => add(getUserId(body), 'user', body.question.trim());

const processWithQueue = ({ body, token }: { body: AskRequest, token?: string }): TE.TaskEither<ApiError, AskResponse> => {
  const jobData: AskJobData = {
    type: 'ask',
    userId: getUserId(body),
    question: body.question.trim(),
    platform: getPlatform(body),
    token,
    jobId: crypto.randomUUID(),
  };

  return TE.tryCatch(
    async () => {
      logger.info(`Adding ASK job to queue for user: ${jobData.userId}`);
      
      await addJob(jobData);
      
      const result = await waitForJobResult(jobData.jobId, 300000);
      
      if (!result.success) {
        const apiError: ApiError = result.error || { 
          message: 'Unknown queue error', 
          code: 'QUEUE_ERROR', 
          statusCode: 500 
        };
        throw apiError;
      }
      
      return result.data as AskResponse;
    },
    (error): ApiError => {
      if (error && typeof error === 'object' && 'code' in error) {
        return error as ApiError;
      }
      logger.error('Queue processing error:', error);
      return apierror(API_ERRORS.PROCESSING_ERROR, String(error));
    }
  );
};

const saveAssistantMessage = ({ body, aiResult }: { body: AskRequest, aiResult: AskResponse }) => add(getUserId(body), 'assistant', aiResult.response);
const createSuccessResponse = ({ body, aiResult }: { body: AskRequest, aiResult: AskResponse }) => success(body)(aiResult);

const check = (req: Request): E.Either<ApiError, Request> =>
  req.method === 'POST'
    ? E.right(req)
    : E.left({ message: 'Method not supported', code: 'METHOD_NOT_SUPPORTED', statusCode: 405 });

const parse = (req: Request): TE.TaskEither<ApiError, AskRequest> =>
  TE.tryCatch(
    () => req.json() as Promise<AskRequest>,
    (e): ApiError => {
      logger.error('Failed to parse request body:', e);
      return { message: 'Invalid JSON body', code: 'INVALID_JSON', statusCode: 400 };
    }
  );

const validate = flow(
  E.fromPredicate(
    (body: AskRequest): body is AskRequest & { question: string } => !!body.question && typeof body.question === 'string',
    (): ApiError => ({ message: "Parameter 'question' is required and must be a string", code: 'QUESTION_REQUIRED', statusCode: 400 })
  ),
  E.chain(
    E.fromPredicate(
      (body): body is AskRequest & { question: string } => body.question.length <= 1000,
      (): ApiError => ({ message: 'Question is too long (maximum 1000 characters)', code: 'QUESTION_TOO_LONG', statusCode: 400 })
    )
  )
);

const checkContent = (content: string) => {
  const trimmedContent = content.trim();
  if (trimmedContent.length === 0) return E.left(apierror(API_ERRORS.EMPTY_QUESTION, 'Content is empty'));
  if (trimmedContent.length > 4000) return E.left(apierror(API_ERRORS.QUESTION_TOO_LONG, 'Content is too long (max 4000 characters)'));
  return E.right(trimmedContent);
};

const build = (role: 'user' | 'assistant') => (content: string): Message & { id: string } => ({ id: crypto.randomUUID(), role, content });

const store = (userId: string, message: Message & { id: string }): TaskEither<ApiError, void> => {
  const key = `chat_history:${userId}`;
  const messageStr = JSON.stringify(message);

  return retry(
    `Redis save message for user ${userId}`,
    policies.critical,
    tryCatch(
      async () => {
        await redis.send("LPUSH", [key, messageStr]);
        await redis.send("LTRIM", [key, "0", (MAX_MESSAGES - 1).toString()]);
        await redis.send("EXPIRE", [key, CHAT_TTL_SECONDS.toString()]);
      },
      (error) => apierror(API_ERRORS.REDIS_ERROR, String(error))
    )
  );
};

export const add = (userId: string, role: 'user' | 'assistant', content: string): TaskEither<ApiError, void> => {
  logger.info(`Adding ${role} message to chat history for user: ${userId}`);

  return pipe(
    TE.fromEither(checkContent(content)),
    TE.map(build(role)),
    TE.chain(message => {
      logger.info(`Message added to chat ${userId}: ${message.role} - ${message.content.substring(0, 50)}...`);
      return store(userId, message);
    })
  );
};

const error = (e: ApiError): Response => {
  logger.error(`API Error: ${e.code} - ${e.message}`);
  return Response.json({
    error: e.message,
    code: e.code,
    status: "error",
    timestamp: new Date().toISOString(),
  }, { status: e.statusCode || 500 });
};

const success = (body: AskRequest) => (aiResult: AskResponse): Response => {
  return Response.json({
    answer: aiResult.response,
    status: "success",
    timestamp: new Date().toISOString(),
    platform: body.platform || 'unknown',
    user_id: body.user_id || 'anonymous',
  });
};
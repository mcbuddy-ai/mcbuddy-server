import { chain as chainE, tryCatch as eitherTryCatch, left, right } from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { chain, fromEither, TaskEither } from 'fp-ts/TaskEither';
import { request } from "../../infrastructure/providers/openrouter/openrouter.client";
import { AIMessage } from "../../infrastructure/providers/openrouter/openrouter.types";
import { policies, retry } from "../../shared/lib/retry";
import { logger } from "../../shared/logging/logger";
import { API_ERRORS, ApiError, apierror } from "../../shared/types/errors";
import { AskXResponse } from "./askx.types";
import { ASKX_SYSTEM_MESSAGE } from './askx.env';

export const askx = (action: string, platform: string = 'minecraft'): TaskEither<ApiError, AskXResponse> => {
  logger.info(`Processing askx request: ${action} for platform: ${platform}`);
  return pipe(
    fromEither(validateIn(action)),
    chain(validAction =>
      retry(
        `AskX completion for action: ${action}`,
        policies.standard,
        request(messages(validAction), platform)
      )
    ),
    chain(response => fromEither(process(response)))
  );
};

const messages = (action: string): AIMessage[] => [
  { role: 'system', content: ASKX_SYSTEM_MESSAGE },
  { role: 'user', content: action }
];

const validateIn = (action: string) => {
  const trimmedAction = action.trim();
  if (trimmedAction.length === 0) return left(apierror(API_ERRORS.EMPTY_ACTION));
  if (trimmedAction.length > 500) return left(apierror(API_ERRORS.ACTION_TOO_LONG));
  return right(trimmedAction);
};

const trim = (response: string) => response.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');

const parse = (response: string) =>
  eitherTryCatch(
    () => JSON.parse(trim(response)),
    (error) => apierror(API_ERRORS.PARSE_ERROR, String(error))
  );

const validateOut = (parsed: any) => {
  if (parsed.error) return left(apierror(API_ERRORS.AI_ERROR, parsed.error));
  if (!Array.isArray(parsed.commands)) return left(apierror(API_ERRORS.INVALID_FORMAT, 'commands must be an array'));
  if (parsed.commands.length > 12) return left(apierror(API_ERRORS.TOO_MANY_COMMANDS));
  return right({
    isSequence: parsed.isSequence || false,
    commands: parsed.commands
  });
};

const process = (response: string) => pipe(parse(response), chainE(validateOut));
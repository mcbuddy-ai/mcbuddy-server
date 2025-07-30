import * as E from 'fp-ts/Either';
import { flow, pipe } from 'fp-ts/function';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { bind, bindTo, chain, chainEitherK, fromEitherK, getOrElse, map, tryCatch } from 'fp-ts/TaskEither';
import { logger } from "../../shared/logging/logger";
import { API_ERRORS, apierror, ApiError } from "../../shared/types/errors";
import { addJob, waitForJobResult, AskXJobData } from "../../infrastructure/queues";
import { AskXRequest, AskXResponse } from "./askx.types";

export const handleAskX = (req: Request) => {
  const token = req.headers.get('X-OpenRouter-Token') || undefined;
  
  return pipe(
    req,
    fromEitherK(check),
    chain(parse),
    chainEitherK(validate),
    bindTo('body'),
    bind('token', () => TE.right(token)),
    bind('askxResult', processWithQueue),
    map(createSuccessResponse),
    getOrElse(e => T.of(error(e)))
  )();
}

const getPlatform = (body: AskXRequest): string => body.platform || 'minecraft';
const getUserId = (body: AskXRequest): string => body.user_id || 'anonymous';

const processWithQueue = ({ body, token }: { body: AskXRequest, token?: string }): TE.TaskEither<ApiError, AskXResponse> => {
  const jobData: AskXJobData = {
    type: 'askx',
    action: body.action.trim(),
    platform: getPlatform(body),
    token,
    jobId: crypto.randomUUID(),
  };

  return TE.tryCatch(
    async () => {
      logger.info(`Adding ASKX job to queue for platform: ${jobData.platform}`);
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
      
      return result.data as AskXResponse;
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

const createSuccessResponse = ({ body, askxResult }: { body: AskXRequest, askxResult: AskXResponse }) => success(body)(askxResult);

const check = (req: Request): E.Either<ApiError, Request> =>
  req.method === 'POST'
    ? E.right(req)
    : E.left({ message: 'Method not supported', code: 'METHOD_NOT_SUPPORTED', statusCode: 405 });

const parse = (req: Request) =>
  tryCatch(
    () => req.json() as Promise<AskXRequest>,
    (e): ApiError => {
      logger.error('Failed to parse request body:', e);
      return { message: 'Invalid JSON body', code: 'INVALID_JSON', statusCode: 400 };
    }
  );

const validate = flow(
  E.fromPredicate(
    (body: AskXRequest) => !body.platform || body.platform === 'minecraft',
    (): ApiError => ({ message: 'Platform not supported', code: 'PLATFORM_NOT_SUPPORTED', statusCode: 400 })
  ),
  E.chain(
    E.fromPredicate(
      (body: AskXRequest): body is AskXRequest & { action: string } => !!body.action && typeof body.action === 'string',
      (): ApiError => ({ message: "Parameter 'action' is required and must be a string", code: 'ACTION_REQUIRED', statusCode: 400 })
    )
  ),
  E.chain(
    E.fromPredicate(
      (body): body is AskXRequest & { action: string } => body.action.length <= 500,
      (): ApiError => ({ message: 'Action is too long (maximum 500 characters)', code: 'ACTION_TOO_LONG', statusCode: 400 })
    )
  )
);

const error = (error: ApiError) => {
  logger.error(`API Error: ${error.code} - ${error.message}`);
  return Response.json(
    { error: error.message, code: error.code },
    { status: error.statusCode || 500 }
  );
};

const success = (body: AskXRequest) => (askXResult: AskXResponse) =>
  Response.json({
    isSequence: askXResult.isSequence,
    commands: askXResult.commands,
    status: 'success',
    timestamp: new Date().toISOString(),
    platform: getPlatform(body),
    user_id: getUserId(body),
  });
import * as E from 'fp-ts/Either';
import { flow, pipe } from 'fp-ts/function';
import { of } from 'fp-ts/Task';
import { bind, bindTo, chain, chainEitherK, fromEitherK, getOrElse, map, tryCatch } from 'fp-ts/TaskEither';
import { logger } from "../../shared/logging/logger";
import { ApiError } from "../../shared/types/errors";
import { askx } from "./askx.service";
import { AskXRequest, AskXResponse } from "./askx.types";

export const handleAskX = (req: Request) =>
  pipe(
    req,
    fromEitherK(check),
    chain(parse),
    chainEitherK(validate),
    bindTo('body'),
    bind('askxResult', getAskXResponse),
    map(createSuccessResponse),
    getOrElse(e => of(error(e)))
  )();

const getPlatform = (body: AskXRequest): string => body.platform || 'minecraft';
const getUserId = (body: AskXRequest): string => body.user_id || 'anonymous';
const getAskXResponse = ({ body }: { body: AskXRequest }) => askx(body.action.trim(), getPlatform(body));
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
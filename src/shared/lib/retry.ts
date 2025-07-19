import { Either, isLeft } from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { getOrElse, map } from 'fp-ts/Option';
import { TaskEither } from 'fp-ts/TaskEither';
import { capDelay, exponentialBackoff, limitRetries, Monoid, RetryPolicy, RetryStatus } from 'retry-ts';
import { retrying } from 'retry-ts/Task';
import { logger } from '../logging/logger';
import { ApiError } from '../types/errors';

export const policies = {
  standard: capDelay(5000, Monoid.concat(exponentialBackoff(500), limitRetries(3))),
  critical: capDelay(10000, Monoid.concat(exponentialBackoff(1000), limitRetries(5)))
}

export const retry = <A>(operation: string, policy: RetryPolicy, task: TaskEither<ApiError, A>): TaskEither<ApiError, A> => retry0(policy, operation, task);

const retryable = (error: ApiError): boolean => error.code === 'NETWORK_ERROR' || error.code === 'AI_REQUEST_FAILED' || error.code === 'NO_AI_RESPONSE' || error.code === 'PARSE_ERROR';

const log = (operation: string) => (status: RetryStatus): void => {
  if (status.iterNumber > 0) {
    const delayMessage = pipe(
      status.previousDelay,
      map((delay) => `retrying in ${delay}ms`),
      getOrElse(() => 'retrying')
    );
    logger.warn(`🔄 Retry attempt ${status.iterNumber} for ${operation} - ${delayMessage}`);
  }
};

const retry0 = <A>(
  policy: RetryPolicy,
  operation: string,
  task: TaskEither<ApiError, A>
): TaskEither<ApiError, A> => {
  const retryableTask = (status: RetryStatus): TaskEither<ApiError, A> => {
    log(operation)(status);
    return task;
  };

  return retrying(
    policy,
    retryableTask,
    (result: Either<ApiError, A>) => {
      if (isLeft(result)) {
        const shouldRetryThis = retryable(result.left);
        if (!shouldRetryThis) {
          logger.error(`❌ Non-retryable error for ${operation}: ${result.left.message}`);
        }
        return shouldRetryThis;
      }
      return false;
    }
  );
};
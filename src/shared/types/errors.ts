export interface ApiError {
  code: string;
  message: string;
  statusCode?: number;
}

export const API_ERRORS = {
  EMPTY_ACTION: { code: 'EMPTY_ACTION', message: 'Action is empty', statusCode: 400 },
  ACTION_TOO_LONG: { code: 'ACTION_TOO_LONG', message: 'Action too long (max 500 characters)', statusCode: 400 },
  PARSE_ERROR: { code: 'PARSE_ERROR', message: 'Failed to parse AI response', statusCode: 500 },
  AI_ERROR: { code: 'AI_ERROR', message: 'AI returned an error', statusCode: 400 },
  INVALID_FORMAT: { code: 'INVALID_FORMAT', message: 'Invalid response format', statusCode: 500 },
  TOO_MANY_COMMANDS: { code: 'TOO_MANY_COMMANDS', message: 'Too many commands (max 12)', statusCode: 400 },
  AI_REQUEST_FAILED: { code: 'AI_REQUEST_FAILED', message: 'AI request failed', statusCode: 503 },
  REDIS_ERROR: { code: 'REDIS_ERROR', message: 'Redis operation failed', statusCode: 500 },
  NETWORK_ERROR: { code: 'NETWORK_ERROR', message: 'Network request failed', statusCode: 503 },
  EMPTY_QUESTION: { code: 'EMPTY_QUESTION', message: 'Question is empty', statusCode: 400 },
  QUESTION_TOO_LONG: { code: 'QUESTION_TOO_LONG', message: 'Question too long (max 1000 characters)', statusCode: 400 },
  NO_AI_RESPONSE: { code: 'NO_AI_RESPONSE', message: 'No response from AI model', statusCode: 503 },
  BAD_REQUEST: { code: 'BAD_REQUEST', message: 'Invalid request body', statusCode: 400 },
  INVALID_JSON: { code: 'INVALID_JSON', message: 'Invalid JSON body', statusCode: 400 },
  METHOD_NOT_SUPPORTED: { code: 'METHOD_NOT_SUPPORTED', message: 'Method not supported', statusCode: 405 },
  PLATFORM_NOT_SUPPORTED: { code: 'PLATFORM_NOT_SUPPORTED', message: 'Platform not supported', statusCode: 400 },
  RUN_NOT_FOUND: { code: 'RUN_NOT_FOUND', message: 'No such run or tool call', statusCode: 404 },
  ALREADY_ANSWERED: { code: 'ALREADY_ANSWERED', message: 'This tool call already has a result', statusCode: 409 },
  CANCELLED: { code: 'CANCELLED', message: 'The request was cancelled', statusCode: 499 },
} as const;

export const apierror = (baseError: typeof API_ERRORS[keyof typeof API_ERRORS], details?: string): ApiError => ({
  ...baseError,
  message: details ? `${baseError.message}: ${details}` : baseError.message
});

/** An ApiError that can be thrown through async code and caught at the edge. */
export class ApiFailure extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(error: ApiError) {
    super(error.message);
    this.code = error.code;
    this.statusCode = error.statusCode ?? 500;
  }

  toApiError(): ApiError {
    return { code: this.code, message: this.message, statusCode: this.statusCode };
  }
}

export const fail = (base: typeof API_ERRORS[keyof typeof API_ERRORS], details?: string): never => {
  throw new ApiFailure(apierror(base, details));
};

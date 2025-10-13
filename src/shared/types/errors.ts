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
  BAD_REQUEST: { code: 'BAD_REQUEST', message: 'Invalid request body', statusCode: 400 }
} as const;

export const apierror = (baseError: typeof API_ERRORS[keyof typeof API_ERRORS], details?: string): ApiError => ({
  ...baseError,
  message: details ? `${baseError.message}: ${details}` : baseError.message
}); 
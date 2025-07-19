import { left, right } from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { chain, fromEither, tryCatch } from 'fp-ts/TaskEither';
import { OpenRouterResponse } from "../../../features/ask/ask.types";
import { policies, retry } from '../../../shared/lib/retry';
import { logger } from "../../../shared/logging/logger";
import { API_ERRORS, apierror } from '../../../shared/types/errors';
import { API_NAME, API_URL, OPENROUTER_API_CTX, OPENROUTER_API_KEY, OPENROUTER_API_MODEL, OPENROUTER_BASE_URL } from './openrouter.env';
import { AIMessage } from './openrouter.types';

export const request = (messages: AIMessage[], platform: string, token?: string) => {
  logger.info(`Making OpenRouter request for platform: ${platform}`);
  
  return pipe(
    perform(messages, platform, token),
    chain(response => fromEither(status(response))),
    chain(parse),
    chain(data => fromEither(validate(data)))
  );
};

const status = (response: Response) => {
  if (!response.ok) {
    return left(apierror(API_ERRORS.AI_REQUEST_FAILED, `${response.status} (${response.statusText})`));
  }
  return right(response);
};

const parse = (response: Response) => 
  tryCatch(
    () => response.json() as Promise<OpenRouterResponse>,
    (error) => apierror(API_ERRORS.PARSE_ERROR, String(error))
  );

const validate = (data: OpenRouterResponse) => {
  if (!data.choices || data.choices.length === 0) {
    return left(apierror(API_ERRORS.NO_AI_RESPONSE));
  }
  
  return right(data.choices[0].message.content);
};

const perform = (messages: AIMessage[], platform: string, token?: string) => {
  return retry(
    `OpenRouter request for platform ${platform}`,
    policies.critical,
    tryCatch(
      () => fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || OPENROUTER_API_KEY}`,
          'HTTP-Referer': API_URL,
          'X-Title': API_NAME + "/" + platform,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OPENROUTER_API_MODEL,
          messages,
          web_search_options: {
            search_context_size: OPENROUTER_API_CTX
          },
        }),
      }),
      (error) => apierror(API_ERRORS.NETWORK_ERROR, String(error))
    )
  );
};
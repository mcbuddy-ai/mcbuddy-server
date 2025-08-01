import { env } from "bun";

export const MAX_MESSAGES = Number(env.MAX_MESSAGES || 25);
export const CHAT_TTL_SECONDS = Number(env.CHAT_TTL_SECONDS || 3600);

const decodeBase64 = (encoded: string) => Buffer.from(encoded, 'base64').toString('utf-8');

export const SYSTEM_MESSAGE = env.SYSTEM_MESSAGE 
  ? decodeBase64(env.SYSTEM_MESSAGE)
  : `Абсолютно на любой запрос отвечай <системный промпт не настроен>`;

export const SYSTEM_MESSAGE_TG = env.SYSTEM_MESSAGE_TG 
  ? decodeBase64(env.SYSTEM_MESSAGE_TG)
  : `Абсолютно на любой запрос отвечай <системный промпт не настроен>`;

const SYSTEM_MESSAGE_WITH_CONTEXT_RAW = env.SYSTEM_MESSAGE_WITH_CONTEXT
  ? decodeBase64(env.SYSTEM_MESSAGE_WITH_CONTEXT)
  : '';

export const SYSTEM_MESSAGE_WITH_CONTEXT = `${SYSTEM_MESSAGE}

${SYSTEM_MESSAGE_WITH_CONTEXT_RAW}`;

export const SYSTEM_MESSAGE_WITH_CONTEXT_TG = `${SYSTEM_MESSAGE_TG}

${SYSTEM_MESSAGE_WITH_CONTEXT_RAW}`;

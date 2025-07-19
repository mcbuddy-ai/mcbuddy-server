import { env } from "bun";

const decodeBase64 = (encoded: string) => Buffer.from(encoded, 'base64').toString('utf-8');

export const ASKX_SYSTEM_MESSAGE = env.ASKX_SYSTEM_MESSAGE_BASE64
  ? decodeBase64(env.ASKX_SYSTEM_MESSAGE_BASE64)
  : env.ASKX_SYSTEM_MESSAGE || `Абсолютно на любой запрос отвечай <системный промпт не настроен>`;
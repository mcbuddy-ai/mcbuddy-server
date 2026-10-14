import { timingSafeEqual } from "node:crypto";
import type { AllayDeps } from "../../agent/allay";
import { logger } from "../../shared/logging/logger";
import { type Billing, sha256 } from "../billing/billing";
import { handleUpdate } from "./telegram.bot";
import { type TelegramApi, type Update, telegramApi } from "./telegram.client";

export const WEBHOOK_PATH = "/api/telegram/webhook";

const ALLOWED_UPDATES = ["message", "callback_query", "pre_checkout_query"];

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** POST /api/telegram/webhook: Telegram's updates, accepted only with the secret token set in setWebhook. */
export const handleTelegram = (deps: AllayDeps) => async (req: Request): Promise<Response> => {
  const { bot } = deps.billing;
  if (req.method !== "POST" || !bot.api || !bot.secret) return new Response(null, { status: 404 });
  if (!same(req.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "", bot.secret)) return new Response(null, { status: 401 });
  const update = (await req.json().catch(() => undefined)) as Update | undefined;
  if (update) {
    try {
      await handleUpdate(deps.billing, bot.api, update);
    } catch (error) {
      // Telegram retries anything but 200; one bad update must not jam the queue.
      logger.error(`Telegram update ${update.update_id} failed: ${String(error)}`);
    }
  }
  return Response.json({ ok: true });
};

/** Long polling for local runs, where Telegram can't reach a webhook. */
const poll = async (billing: Billing, api: TelegramApi) => {
  let offset = 0;
  for (;;) {
    try {
      const updates = await api.call<Update[]>("getUpdates", { offset, timeout: 30, allowed_updates: ALLOWED_UPDATES });
      for (const update of updates) {
        offset = update.update_id + 1;
        await handleUpdate(billing, api, update).catch((error) => logger.error(`Telegram update ${update.update_id} failed: ${String(error)}`));
      }
    } catch {
      await Bun.sleep(5_000);
    }
  }
};

/**
 * Starts the payment bot when billing is on and TELEGRAM_BOT_TOKEN is set: learns its username for
 * payment links, then takes updates through the webhook at API_URL, or by polling with TELEGRAM_POLLING=1.
 */
export const startTelegram = async (billing: Billing) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!billing.enabled) return;
  if (!token) {
    logger.warn("Billing is on, but TELEGRAM_BOT_TOKEN is not set: servers can't get payment links");
    return;
  }
  const api = telegramApi(token, { base: process.env.TELEGRAM_API_URL, test: process.env.TELEGRAM_TEST_ENV === "1" });
  // Derived from the token unless set, so there's no second secret to keep.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || sha256(`allay-webhook:${token}`);
  const me = await api.call<{ username: string }>("getMe");
  Object.assign(billing.bot, { api, secret, username: me.username });
  await api.call("setMyCommands", {
    commands: [
      { command: "status", description: "Your servers and their limits" },
      { command: "start", description: "How to link a server" },
    ],
  });
  if (process.env.TELEGRAM_POLLING === "1") {
    await api.call("deleteWebhook");
    logger.info(`Telegram bot @${me.username} polls for updates`);
    void poll(billing, api);
    return;
  }
  const url = `${(process.env.API_URL || "https://allay.chat").replace(/\/$/, "")}${WEBHOOK_PATH}`;
  await api.call("setWebhook", { url, secret_token: secret, allowed_updates: ALLOWED_UPDATES });
  logger.info(`Telegram bot @${me.username} takes updates at ${url}`);
};

/** Blanks a key out of text that may echo it, such as a provider's error message. */
export const redact = (text: string, key?: string) => (key && key.length >= 8 ? text.split(key).join("[key]") : text);

/** A secret as logs and status may show it: the first 5 and last 4 characters at most. */
export const mask = (secret: string) => (secret.length <= 12 ? "…" : `${secret.slice(0, 5)}…${secret.slice(-4)}`);

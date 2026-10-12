const valid = (zone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

/**
 * The player's real date and time, put in front of each Minecraft question: "[Mon, 12 Oct 2026, 18:42 Europe/Moscow]".
 * It goes into the message, not the system prompt, so the prompt stays the same and the provider's cache keeps working.
 * Kept in the history too, so the model can tell how long ago an earlier question was.
 */
export const localStamp = (timezone: string | undefined, now: Date = new Date()): string => {
  const zone = timezone && valid(timezone) ? timezone : "UTC";
  // Built from parts: the joined format differs between ICU versions ("12 Oct 2026, 18:42" or "12 Oct 2026 at 18:42").
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return `[${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute} ${zone}]`;
};

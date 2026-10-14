import type { GrantRecord } from "../../infrastructure/billing/licenses";

export type PlanId = "week" | "month" | "year";

/**
 * What a payment buys. The budget is US dollars the server's questions may cost per window,
 * priced at about twice our cost when a server spends all of it (see CLAUDE.md, “Billing”).
 */
export interface Plan {
  id: PlanId;
  stars: number;
  days: number;
  /** Dollars per window; a year has twelve windows that refill one after another. */
  budget: number;
  windows: number;
  /** Paid as a Telegram Stars subscription that renews every 30 days by itself. */
  subscription: boolean;
}

const BASE: Record<PlanId, Plan> = {
  week: { id: "week", stars: 150, days: 7, budget: 0.75, windows: 1, subscription: false },
  month: { id: "month", stars: 500, days: 30, budget: 3, windows: 1, subscription: true },
  year: { id: "year", stars: 10_000, days: 365, budget: 6, windows: 12, subscription: false },
};

/** PLAN_STARS=week=1,month=1,year=1 lowers the prices for a test payment that gets refunded. */
const overrides = () =>
  Object.fromEntries(
    (process.env.PLAN_STARS || "")
      .split(",")
      .map((pair) => pair.split("=").map((s) => s.trim()))
      .filter(([id, stars]) => id in BASE && Number(stars) >= 1)
      .map(([id, stars]) => [id, Number(stars)]),
  ) as Partial<Record<PlanId, number>>;

export const plans = (): Plan[] => {
  const stars = overrides();
  return Object.values(BASE).map((plan) => ({ ...plan, stars: stars[plan.id] ?? plan.stars }));
};

export const planOf = (id: string): Plan | undefined => plans().find((plan) => plan.id === id);

const DAY = 86_400_000;

/**
 * The budget windows a payment adds. Its money is there at once, and the period ends that many days
 * after the current one would have; a year refills every twelfth of the year instead.
 */
export const windowsFor = (plan: Plan, now: Date, paidUntil: Date | null): Array<Pick<GrantRecord, "budget" | "starts" | "ends">> => {
  const end = Math.max(now.getTime(), paidUntil?.getTime() ?? 0) + plan.days * DAY;
  if (plan.windows === 1) return [{ budget: plan.budget, starts: now, ends: new Date(end) }];
  const step = (plan.days * DAY) / plan.windows;
  return Array.from({ length: plan.windows }, (_, i) => ({
    budget: plan.budget,
    starts: new Date(now.getTime() + i * step),
    ends: new Date(i === plan.windows - 1 ? end : now.getTime() + (i + 1) * step),
  }));
};

export interface Quota {
  active: boolean;
  paidUntil: Date | null;
  /** Dollars left in the windows open now. */
  remaining: number;
  usedPercent: number;
  /** When the open budget ends, or when the next window opens once it's spent; null when only a payment helps. */
  resetsAt: Date | null;
}

const open = (grant: GrantRecord, now: Date) => grant.starts <= now && now < grant.ends;

export const quotaOf = (grants: GrantRecord[], now: Date): Quota => {
  const paidUntil = grants.length ? new Date(Math.max(...grants.map((g) => g.ends.getTime()))) : null;
  const current = grants.filter((g) => open(g, now));
  const budget = current.reduce((sum, g) => sum + g.budget, 0);
  const spent = current.reduce((sum, g) => sum + g.spent, 0);
  const remaining = Math.max(0, budget - spent);
  const active = !!paidUntil && paidUntil > now;
  // Nothing open while paid means a year between windows, which can't happen; unpaid means no limit to report.
  const usedPercent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : active ? 100 : 0;
  const next = grants.filter((g) => g.starts > now).sort((a, b) => a.starts.getTime() - b.starts.getTime())[0];
  const ending = current.sort((a, b) => a.ends.getTime() - b.ends.getTime())[0];
  return {
    active,
    paidUntil,
    remaining,
    usedPercent,
    resetsAt: remaining > 0 ? (ending?.ends ?? null) : (next?.starts ?? null),
  };
};

/**
 * Splits a cost over the open windows that still have money, the soonest to end first. Whatever is
 * left lands on the soonest window anyway: a run is charged after it ran, so it may overshoot a little.
 */
export const allocate = (grants: GrantRecord[], usd: number, now: Date): Array<{ grant: string; usd: number }> => {
  const current = grants.filter((g) => open(g, now)).sort((a, b) => a.ends.getTime() - b.ends.getTime());
  if (!current.length || usd <= 0) return [];
  const parts: Array<{ grant: string; usd: number }> = [];
  let left = usd;
  for (const grant of current) {
    const take = Math.min(left, Math.max(0, grant.budget - grant.spent));
    if (take > 0) {
      parts.push({ grant: grant.id, usd: take });
      left -= take;
    }
    if (left <= 0) break;
  }
  if (left > 0) parts.push({ grant: current[0].id, usd: left });
  return parts;
};

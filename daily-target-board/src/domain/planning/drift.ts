export interface CalendarDrift {
  /** Holidays that exist now but were not there when the plan was published. */
  added: string[];
  /** Holidays the plan was built with that no longer exist. */
  removed: string[];
  /** True when the plan no longer matches the calendar. */
  stale: boolean;
}

/** Compare the holidays a plan was published with against the holidays that exist now. */
export function calendarDrift(
  atPublish: readonly string[],
  current: readonly string[],
): CalendarDrift {
  const published = new Set(atPublish);
  const now = new Set(current);
  const added = [...now].filter((date) => !published.has(date)).sort();
  const removed = [...published].filter((date) => !now.has(date)).sort();
  return { added, removed, stale: added.length > 0 || removed.length > 0 };
}
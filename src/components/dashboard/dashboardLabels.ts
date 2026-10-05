import type { UpcomingRow } from "../../domain/dashboard";
import { daysBetweenKeys, keyParts, weekdayOfKey } from "../../domain/dateKeys";
import { calendarCopy, dashboardCopy, terms } from "../../lib/copy";
import { laterDuePhrase } from "../../lib/format";
import { WEEKDAY_SHORT } from "../../lib/recurrenceFormat";
import type { Task } from "../../types";
import { spanLabel, timeLine, upcomingSpan } from "../calendar/calendarLabels";

/** Start's visible text (`Dashboard.dc.html`, Phase 8 D68–D71). */

/**
 * The line under the greeting (D69): «3 Aufgaben heute · 6 Artikel offen · 5 Termine diese
 * Woche». A `null` count leaves its part out (that list is loading or failed).
 */
export function dashboardSummary(counts: {
  tasks: number | null;
  items: number | null;
  events: number | null;
}): string {
  return calendarCopy.meta(
    counts.tasks === null ? "" : dashboardCopy.tasksToday(counts.tasks),
    counts.items === null ? "" : dashboardCopy.itemsOpen(counts.items),
    counts.events === null ? "" : dashboardCopy.eventsThisWeek(counts.events),
  );
}

/**
 * «Alles erledigt 🎉» text (D68): on phones «Gut gemacht, ihr zwei.» plus «Als Nächstes: …»,
 * on desktop the second sentence only (as designed). The second sentence is left out without
 * a next task.
 */
export function allDoneText(
  memberCount: number,
  next: Pick<Task, "title" | "dueDate"> | null,
  today: string,
): { mobile: string; desktop: string } {
  const nextUp =
    next?.dueDate != null
      ? dashboardCopy.nextUp(next.title, laterDuePhrase(next.dueDate, today))
      : "";
  return {
    mobile: [dashboardCopy.wellDone(memberCount), nextUp].filter(Boolean).join(" "),
    desktop: nextUp,
  };
}

/** The date column of a «Demnächst» row: «Do» over «1». */
export function upcomingDateColumn(dayKey: string): { weekday: string; day: string } {
  return { weekday: WEEKDAY_SHORT[weekdayOfKey(dayKey)], day: String(keyParts(dayKey).day) };
}

/**
 * When a «Demnächst» row is (D71): «19:30–22:30», «Ganztägig», for a multi-day all-day event
 * «14.–21. Okt. · 8 Tage» or, once running, «Tag 3 von 8»; prefixed «Heute · » / «Morgen · »
 * on those days.
 */
export function upcomingWhen(row: UpcomingRow, today: string, timeZone: string): string {
  const { occurrence, dayKey } = row;
  let when = timeLine(occurrence, dayKey, timeZone);
  if (occurrence.event.allDay) {
    // Running since an earlier day: «Tag 3 von 8»; starting on this day: «14.–21. Okt. · 8 Tage».
    const running = occurrence.date < dayKey;
    when = (running ? spanLabel(occurrence, dayKey) : upcomingSpan(occurrence)) ?? terms.allDay;
  }
  const days = daysBetweenKeys(today, dayKey);
  const relative = days === 0 ? terms.today : days === 1 ? terms.tomorrow : "";
  return calendarCopy.meta(relative, when);
}

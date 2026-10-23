import { createContext, useContext } from "react";
import type {
  CalendarEvent,
  EventChanges,
  EventOccurrence,
  EventOverride,
  NewEventInput,
} from "../../types";
import type { EventFormFocus } from "./EventForm";
import type { EventPrefill } from "./eventFormValues";

export interface CalendarActions {
  /** Creates an event with «event_created» (CAL-04, B12); returns its id. */
  create: (input: NewEventInput) => string;
  update: (event: CalendarEvent, changes: EventChanges) => void;
  remove: (event: CalendarEvent) => void;
  /** REV-07 (Phase 9): cancels the occurrence of the series `event` on schedule date `dateKey`. */
  cancelOccurrence: (event: CalendarEvent, dateKey: string) => void;
  /** REV-07 (Phase 9): changes that occurrence on its own. */
  editOccurrence: (event: CalendarEvent, dateKey: string, override: EventOverride) => void;
}

export interface NewEventOptions {
  prefill?: EventPrefill;
  /** The field the sheet focuses first (D56). */
  focus?: EventFormFocus;
}

export interface CalendarContextValue {
  actions: CalendarActions;
  /** «Neuer Termin» (D47): a sheet on phones, a 560 px dialog on desktop (D46). */
  openNewEvent: (options?: NewEventOptions) => void;
  /**
   * «Termin bearbeiten»; `onDeleted` runs when the event is deleted from the sheet (as for
   * `confirmDelete`).
   */
  openEditEvent: (eventId: string, onDeleted?: () => void) => void;
  /**
   * «Bearbeiten» on an occurrence: a series first asks «Nur diesen Termin / Ganze Serie»
   * (Phase 9 D92), a one-off event opens its sheet.
   */
  editOccurrence: (occurrence: EventOccurrence, onDeleted?: () => void) => void;
  /**
   * The delete confirmation (D53); `onDeleted` runs right before the delete is sent (e.g. to
   * leave the Termin-Detail). With an occurrence of a series, it asks «Nur diesen Termin /
   * Ganze Serie» (Phase 9 D92); without, a series is deleted as a whole (D62).
   */
  confirmDelete: (
    event: CalendarEvent,
    onDeleted?: () => void,
    occurrence?: EventOccurrence,
  ) => void;
  /** Whether this device deleted the event (so it doesn't count as «deleted elsewhere», D52). */
  deletedHere: (eventId: string) => boolean;
}

export const CalendarContext = createContext<CalendarContextValue | null>(null);

/** Calendar writes and sheets. Needs a <CalendarProvider> (loaded household). */
export function useCalendar(): CalendarContextValue {
  const value = useContext(CalendarContext);
  if (!value) throw new Error("useCalendar() must be used inside <CalendarProvider>.");
  return value;
}

/** Like useCalendar(), but null outside a loaded household (shell error state, D8). */
export function useOptionalCalendar(): CalendarContextValue | null {
  return useContext(CalendarContext);
}

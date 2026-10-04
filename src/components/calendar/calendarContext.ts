import { createContext, useContext } from "react";
import type { CalendarEvent, EventChanges, NewEventInput } from "../../types";
import type { EventFormFocus } from "./EventForm";
import type { EventPrefill } from "./eventFormValues";

export interface CalendarActions {
  /** Creates an event with «event_created» (CAL-04, B12); returns its id. */
  create: (input: NewEventInput) => string;
  update: (event: CalendarEvent, changes: EventChanges) => void;
  remove: (event: CalendarEvent) => void;
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
   * The delete confirmation (D53); `onDeleted` runs right before the delete is sent (e.g. to
   * leave the Termin-Detail).
   */
  confirmDelete: (event: CalendarEvent, onDeleted?: () => void) => void;
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

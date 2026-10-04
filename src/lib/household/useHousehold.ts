import { createContext, useContext } from "react";
import type { CalendarEvent, Household, ItemStat, Member, ShoppingItem, Task } from "../../types";

export interface HouseholdContextValue {
  /** null while loading or after an error. */
  household: Household | null;
  /** Owner first, then by join date (sortMembers). */
  members: Member[];
  /** The signed-in user's member doc. */
  me: Member | null;
  isOwner: boolean;
  memberById: (uid: string) => Member | undefined;
  /** True until household and members have both arrived. */
  loading: boolean;
  /** Listener error, or a missing household (D8). */
  error: Error | null;
  /** Subscribes again after an error. */
  retry: () => void;
  /** All tasks of the household, unsorted (see domain/tasks). */
  tasks: Task[];
  /** True until the first task snapshot has arrived (D13). */
  tasksLoading: boolean;
  /** Task listener error (D14); doesn't affect `error`. */
  tasksError: Error | null;
  /** Subscribes to the tasks again after an error. */
  retryTasks: () => void;
  /** All shopping items, open and checked, unsorted (see domain/shopping). */
  items: ShoppingItem[];
  /** True until the first shopping snapshot has arrived (D38). */
  itemsLoading: boolean;
  /** Shopping listener error (D39); doesn't affect `error`. */
  itemsError: Error | null;
  /** Subscribes to the shopping list again after an error. */
  retryItems: () => void;
  /** Purchase history for the suggestions (B9); empty until loaded or after an error. */
  itemStats: ItemStat[];
  /** All calendar events, unsorted (B10; the views use domain/calendar). */
  events: CalendarEvent[];
  /** True until the first event snapshot has arrived (D49). */
  eventsLoading: boolean;
  /** Event listener error (D50); doesn't affect `error`. */
  eventsError: Error | null;
  /** Subscribes to the events again after an error. */
  retryEvents: () => void;
}

export const HouseholdContext = createContext<HouseholdContextValue | null>(null);

/** Realtime household of the signed-in member (inside MemberRoute). */
export function useHousehold(): HouseholdContextValue {
  const value = useContext(HouseholdContext);
  if (!value) throw new Error("useHousehold() must be used inside <HouseholdProvider>.");
  return value;
}

/** The loaded household; for pages rendered once HouseholdProvider has loaded it. */
export function useLoadedHousehold(): HouseholdContextValue & { household: Household } {
  const value = useHousehold();
  if (!value.household) throw new Error("useLoadedHousehold() needs a loaded household.");
  return value as HouseholdContextValue & { household: Household };
}

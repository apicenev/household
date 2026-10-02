import { createContext, useContext } from "react";
import type { Household, Member, Task } from "../../types";

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

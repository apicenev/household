import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { isOwner, sortMembers } from "../../domain/household";
import { firestoreErrorCode } from "../firestoreErrors";
import { listenToEvents } from "../../services/eventService";
import { listenToHousehold } from "../../services/householdService";
import { listenToMembers } from "../../services/memberService";
import { listenToItems, listenToItemStats } from "../../services/shoppingService";
import { listenToTasks } from "../../services/taskService";
import { clearStaleHousehold } from "../../services/userService";
import type { CalendarEvent, Household, ItemStat, Member, ShoppingItem, Task } from "../../types";
import { markHouseholdEnded } from "./householdEnded";
import { HouseholdContext, type HouseholdContextValue } from "./useHousehold";

interface Snapshot {
  household: Household | null;
  householdLoaded: boolean;
  members: Member[];
  membersLoaded: boolean;
  /** The member is out (removed, household deleted); waiting for the redirect (B6). */
  ending: boolean;
  error: Error | null;
}

const initial: Snapshot = {
  household: null,
  householdLoaded: false,
  members: [],
  membersLoaded: false,
  ending: false,
  error: null,
};

interface TasksSnapshot {
  tasks: Task[];
  loaded: boolean;
  error: Error | null;
}

const initialTasks: TasksSnapshot = { tasks: [], loaded: false, error: null };

interface ItemsSnapshot {
  items: ShoppingItem[];
  loaded: boolean;
  error: Error | null;
}

const initialItems: ItemsSnapshot = { items: [], loaded: false, error: null };

interface EventsSnapshot {
  events: CalendarEvent[];
  loaded: boolean;
  error: Error | null;
}

const initialEvents: EventsSnapshot = { events: [], loaded: false, error: null };

/**
 * Realtime store of one household (NFR-03): the household document, its members, tasks and
 * shopping list (with the purchase history) and calendar events.
 * Mount it with `key={householdId}`, so a change of household tears down all listeners.
 * `loading` (which gates the shell) waits only for household and members; the task list has
 * its own loading and error state, so it never blocks the shell (Phase 3 D13, D14); so has the
 * shopping list (Phase 5 D38, D39) and the calendar (Phase 6 D49, D50; all events, B10). A
 * failing itemStats listener only means no suggestions, so its error is ignored. The activity
 * feed has its own listener on /activity (Phase 8 B1), so app start doesn't read it.
 *
 * Self-heal (Phase 9 B6): when the server says the household is gone or no longer readable
 * (`permission-denied`), the profile's householdId is cleared, which sends the member to
 * onboarding with the D88 notice. Until then the App-Start screen shows; if the clear is
 * rejected (still a member, a real error), the D8 error state.
 */
export function HouseholdProvider({
  householdId,
  uid,
  children,
}: {
  householdId: string;
  uid: string;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const [attempt, setAttempt] = useState(0);
  const [tasksSnapshot, setTasksSnapshot] = useState<TasksSnapshot>(initialTasks);
  const [tasksAttempt, setTasksAttempt] = useState(0);
  const [itemsSnapshot, setItemsSnapshot] = useState<ItemsSnapshot>(initialItems);
  const [itemsAttempt, setItemsAttempt] = useState(0);
  const [itemStats, setItemStats] = useState<ItemStat[]>([]);
  const [eventsSnapshot, setEventsSnapshot] = useState<EventsSnapshot>(initialEvents);
  const [eventsAttempt, setEventsAttempt] = useState(0);

  useEffect(() => {
    let ending = false;
    const fail = (error: Error) => setSnapshot((current) => ({ ...current, error }));
    const end = () => {
      if (ending) return;
      ending = true;
      setSnapshot((current) => ({ ...current, ending: true }));
      clearStaleHousehold(uid, householdId)
        .then((cleared) => {
          if (cleared) markHouseholdEnded();
        })
        .catch((error: Error) => setSnapshot((current) => ({ ...current, ending: false, error })));
    };
    const failOrEnd = (error: Error) =>
      firestoreErrorCode(error) === "permission-denied" ? end() : fail(error);
    const unsubscribeHousehold = listenToHousehold(
      householdId,
      (household) => {
        if (!household) {
          end();
          return;
        }
        setSnapshot((current) => ({ ...current, household, householdLoaded: true }));
      },
      failOrEnd,
    );
    const unsubscribeMembers = listenToMembers(
      householdId,
      (members) =>
        setSnapshot((current) => ({
          ...current,
          members: sortMembers(members),
          membersLoaded: true,
        })),
      failOrEnd,
    );
    return () => {
      unsubscribeHousehold();
      unsubscribeMembers();
    };
  }, [householdId, uid, attempt]);

  useEffect(
    () =>
      listenToTasks(
        householdId,
        (tasks) => setTasksSnapshot({ tasks, loaded: true, error: null }),
        (error) => setTasksSnapshot((current) => ({ ...current, error })),
      ),
    [householdId, tasksAttempt],
  );

  useEffect(
    () =>
      listenToItems(
        householdId,
        (items) => setItemsSnapshot({ items, loaded: true, error: null }),
        (error) => setItemsSnapshot((current) => ({ ...current, error })),
      ),
    [householdId, itemsAttempt],
  );

  useEffect(
    () => listenToItemStats(householdId, setItemStats, () => {}),
    [householdId, itemsAttempt],
  );

  useEffect(
    () =>
      listenToEvents(
        householdId,
        (events) => setEventsSnapshot({ events, loaded: true, error: null }),
        (error) => setEventsSnapshot((current) => ({ ...current, error })),
      ),
    [householdId, eventsAttempt],
  );

  const retry = useCallback(() => {
    setSnapshot(initial);
    setAttempt((count) => count + 1);
  }, []);

  const retryTasks = useCallback(() => {
    setTasksSnapshot(initialTasks);
    setTasksAttempt((count) => count + 1);
  }, []);

  const retryItems = useCallback(() => {
    setItemsSnapshot(initialItems);
    setItemsAttempt((count) => count + 1);
  }, []);

  const retryEvents = useCallback(() => {
    setEventsSnapshot(initialEvents);
    setEventsAttempt((count) => count + 1);
  }, []);

  const value = useMemo<HouseholdContextValue>(() => {
    const { household, members, error } = snapshot;
    const byId = new Map(members.map((member) => [member.uid, member]));
    return {
      household: error ? null : household,
      members,
      me: byId.get(uid) ?? null,
      isOwner: household !== null && isOwner(household, uid),
      memberById: (memberId) => byId.get(memberId),
      loading: !error && (snapshot.ending || !(snapshot.householdLoaded && snapshot.membersLoaded)),
      error,
      retry,
      tasks: tasksSnapshot.tasks,
      tasksLoading: !tasksSnapshot.loaded && !tasksSnapshot.error,
      tasksError: tasksSnapshot.error,
      retryTasks,
      items: itemsSnapshot.items,
      itemsLoading: !itemsSnapshot.loaded && !itemsSnapshot.error,
      itemsError: itemsSnapshot.error,
      retryItems,
      itemStats,
      events: eventsSnapshot.events,
      eventsLoading: !eventsSnapshot.loaded && !eventsSnapshot.error,
      eventsError: eventsSnapshot.error,
      retryEvents,
    };
  }, [
    snapshot,
    tasksSnapshot,
    itemsSnapshot,
    itemStats,
    eventsSnapshot,
    uid,
    retry,
    retryTasks,
    retryItems,
    retryEvents,
  ]);

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

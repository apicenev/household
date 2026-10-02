import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { isOwner, sortMembers } from "../../domain/household";
import { listenToHousehold } from "../../services/householdService";
import { listenToMembers } from "../../services/memberService";
import type { Household, Member } from "../../types";
import { HouseholdContext, type HouseholdContextValue } from "./useHousehold";

interface Snapshot {
  household: Household | null;
  householdLoaded: boolean;
  members: Member[];
  membersLoaded: boolean;
  error: Error | null;
}

const initial: Snapshot = {
  household: null,
  householdLoaded: false,
  members: [],
  membersLoaded: false,
  error: null,
};

/**
 * Realtime store of one household (NFR-03): the household document and its members. Mount it
 * with `key={householdId}`, so a change of household tears down all listeners. Later phases
 * add tasks, shopping, events and activity here.
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

  useEffect(() => {
    const fail = (error: Error) => setSnapshot((current) => ({ ...current, error }));
    const unsubscribeHousehold = listenToHousehold(
      householdId,
      (household) => {
        if (!household) {
          fail(new Error(`Household ${householdId} doesn't exist.`));
          return;
        }
        setSnapshot((current) => ({ ...current, household, householdLoaded: true }));
      },
      fail,
    );
    const unsubscribeMembers = listenToMembers(
      householdId,
      (members) =>
        setSnapshot((current) => ({
          ...current,
          members: sortMembers(members),
          membersLoaded: true,
        })),
      fail,
    );
    return () => {
      unsubscribeHousehold();
      unsubscribeMembers();
    };
  }, [householdId, attempt]);

  const retry = useCallback(() => {
    setSnapshot(initial);
    setAttempt((count) => count + 1);
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
      loading: !error && !(snapshot.householdLoaded && snapshot.membersLoaded),
      error,
      retry,
    };
  }, [snapshot, uid, retry]);

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

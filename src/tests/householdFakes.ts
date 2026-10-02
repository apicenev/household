import { vi } from "vitest";
import type { Household, Member, UserProfile } from "../types";

/**
 * In-memory stand-ins for the household, member and invite services, for component and
 * routing tests. Use with:
 *   vi.mock("../lib/firebase", () => ({ auth: {}, db: {} }));
 *   vi.mock("../services/householdService", () => import("./householdFakes").then((f) => f.householdServiceMock));
 */

export const nevioProfile: UserProfile = {
  uid: "nevio",
  displayName: "Nevio",
  email: "nevio@example.ch",
  initials: "NE",
  avatarColor: 6,
  householdId: "h1",
  createdAt: new Date("2026-09-01T10:00:00Z"),
};

export function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: "h1",
    name: "Musterstrasse 12",
    ownerId: "nevio",
    memberIds: ["nevio", "anna"],
    weekStartsOn: 1,
    timeZone: "Europe/Zurich",
    inviteCode: "MST-4821",
    inviteCreatedAt: new Date(),
    createdAt: new Date("2026-09-14T10:00:00Z"),
    updatedAt: new Date("2026-09-14T10:00:00Z"),
    ...overrides,
  };
}

export function makeMember(overrides: Partial<Member> & { uid: string }): Member {
  return {
    displayName: overrides.uid,
    initials: overrides.uid.slice(0, 2).toUpperCase(),
    avatarColor: 1,
    role: "member",
    joinedAt: new Date("2026-09-20T10:00:00Z"),
    ...overrides,
  };
}

export const defaultMembers = (): Member[] => [
  makeMember({ uid: "anna", displayName: "Anna", initials: "AN" }),
  makeMember({
    uid: "nevio",
    displayName: "Nevio",
    initials: "NE",
    avatarColor: 6,
    role: "owner",
    joinedAt: new Date("2026-09-14T10:00:00Z"),
  }),
];

interface Listener<T> {
  hid: string;
  onChange: (value: T) => void;
  onError: (error: Error) => void;
}

export const fakeStore = {
  household: makeHousehold() as Household | null,
  members: defaultMembers(),
  /** When set, the listeners fail with it. */
  error: null as Error | null,
  /** Listeners don't answer until emit() (loading state). */
  hold: false,
  householdListeners: new Set<Listener<Household | null>>(),
  memberListeners: new Set<Listener<Member[]>>(),
  /** Household ids in subscription / unsubscription order. */
  subscribed: [] as string[],
  unsubscribed: [] as string[],

  reset() {
    this.household = makeHousehold();
    this.members = defaultMembers();
    this.error = null;
    this.hold = false;
    this.householdListeners.clear();
    this.memberListeners.clear();
    this.subscribed = [];
    this.unsubscribed = [];
  },

  /** Delivers the current state to every listener. */
  emit() {
    for (const listener of this.householdListeners) deliverHousehold(listener);
    for (const listener of this.memberListeners) deliverMembers(listener);
  },
};

function deliverHousehold(listener: Listener<Household | null>) {
  if (fakeStore.error) listener.onError(fakeStore.error);
  else listener.onChange(fakeStore.household);
}

function deliverMembers(listener: Listener<Member[]>) {
  if (fakeStore.error) listener.onError(fakeStore.error);
  else listener.onChange(fakeStore.members);
}

function listen<T>(
  set: Set<Listener<T>>,
  deliver: (listener: Listener<T>) => void,
  hid: string,
  onChange: (value: T) => void,
  onError: (error: Error) => void,
) {
  const listener = { hid, onChange, onError };
  set.add(listener);
  if (!fakeStore.hold) deliver(listener);
  return () => {
    set.delete(listener);
  };
}

export const householdServiceMock = {
  listenToHousehold: (
    hid: string,
    onChange: (household: Household | null) => void,
    onError: (error: Error) => void,
  ) => {
    fakeStore.subscribed.push(hid);
    const stop = listen(fakeStore.householdListeners, deliverHousehold, hid, onChange, onError);
    return () => {
      fakeStore.unsubscribed.push(hid);
      stop();
    };
  },
  createHousehold: vi.fn<(profile: UserProfile, name: string) => Promise<string>>(),
  updateHouseholdSettings: vi.fn(),
};

export const memberServiceMock = {
  listenToMembers: (
    hid: string,
    onChange: (members: Member[]) => void,
    onError: (error: Error) => void,
  ) => listen(fakeStore.memberListeners, deliverMembers, hid, onChange, onError),
  updateMyProfile: vi.fn(),
};

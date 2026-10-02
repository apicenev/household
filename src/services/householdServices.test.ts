import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Household, Invite, UserProfile } from "../types";

// In-memory stand-in for the Firestore calls the services make: batches record their
// operations, server reads come from `serverDocs`.
const fake = vi.hoisted(() => {
  type Ref = { path: string; id: string; withConverter: () => Ref };
  const state = {
    ops: [] as Array<{ op: "set" | "update" | "delete"; path: string; data?: unknown }>,
    commits: [] as Array<Array<{ op: string; path: string; data?: unknown }>>,
    serverDocs: new Map<string, unknown>(),
    serverReads: [] as string[],
    commitResults: [] as Array<Error | null>,
    onCommit: undefined as (() => void) | undefined,
    autoId: 0,
  };
  const ref = (path: string): Ref => {
    const r: Ref = { path, id: path.split("/").pop() ?? "", withConverter: () => r };
    return r;
  };
  const firestoreError = (code: string) => Object.assign(new Error(code), { code });
  return { state, ref, firestoreError };
});

vi.mock("../lib/firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", () => {
  const { state, ref } = fake;
  type Parent = { kind?: string; path?: string };
  return {
    Timestamp: class {},
    collection: (_db: unknown, ...segments: string[]) => ({
      kind: "collection",
      path: segments.join("/"),
      withConverter() {
        return this;
      },
    }),
    doc: (parent: Parent, ...segments: string[]) =>
      parent?.kind === "collection"
        ? ref(`${parent.path}/${segments[0] ?? `auto${++state.autoId}`}`)
        : ref(segments.join("/")),
    writeBatch: () => {
      const ops: typeof state.ops = [];
      return {
        set: (r: { path: string }, data: unknown) => ops.push({ op: "set", path: r.path, data }),
        update: (r: { path: string }, data: unknown) =>
          ops.push({ op: "update", path: r.path, data }),
        delete: (r: { path: string }) => ops.push({ op: "delete", path: r.path }),
        commit: async () => {
          state.commits.push(ops);
          state.onCommit?.();
          const result = state.commitResults.shift();
          if (result) throw result;
        },
      };
    },
    getDocFromServer: async (r: { path: string }) => {
      state.serverReads.push(r.path);
      const failure = state.serverDocs.get(`!${r.path}`);
      if (failure) throw failure;
      return {
        exists: () => state.serverDocs.has(r.path),
        data: () => state.serverDocs.get(r.path),
      };
    },
    serverTimestamp: () => "SERVER_TIME",
    arrayUnion: (...values: unknown[]) => ({ arrayUnion: values }),
    increment: (n: number) => ({ increment: n }),
    onSnapshot: vi.fn(),
  };
});

const codes = vi.hoisted(() => ({ queue: [] as string[] }));
vi.mock("../domain/invite", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../domain/invite")>()),
  generateInviteCode: () => codes.queue.shift() ?? "ZZZ-9999",
}));

const { createHousehold, updateHouseholdSettings } = await import("./householdService");
const { JoinError, getInvite, joinHousehold, regenerateInvite } = await import("./inviteService");
const { updateMyProfile } = await import("./memberService");

const nevio: UserProfile = {
  uid: "nevio",
  displayName: "Nevio",
  email: "nevio@example.ch",
  initials: "NE",
  avatarColor: 3,
  householdId: "h1",
  createdAt: new Date(2026, 8, 1),
};
const anna: UserProfile = {
  ...nevio,
  uid: "anna",
  displayName: "Anna",
  initials: "AN",
  email: "anna@example.ch",
  avatarColor: 6,
  householdId: undefined,
};

const household: Household = {
  id: "h1",
  name: "Musterstrasse 12",
  ownerId: "nevio",
  memberIds: ["nevio", "anna"],
  weekStartsOn: 1,
  timeZone: "Europe/Zurich",
  inviteCode: "MST-4821",
  inviteCreatedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function invite(overrides: Partial<Invite> = {}): Invite {
  return {
    code: "MST-4821",
    householdId: "h1",
    householdName: "Musterstrasse 12",
    ownerName: "Nevio",
    memberCount: 1,
    createdBy: "nevio",
    createdAt: new Date(),
    ...overrides,
  };
}

const { state, firestoreError } = fake;

beforeEach(() => {
  state.ops = [];
  state.commits = [];
  state.serverDocs = new Map();
  state.serverReads = [];
  state.commitResults = [];
  state.onCommit = undefined;
  codes.queue = [];
});

describe("createHousehold", () => {
  it("writes household, owner member, invite and profile in one batch", async () => {
    codes.queue = ["ABC-1234"];
    const hid = await createHousehold(nevio, "WG Linde");

    expect(state.commits).toHaveLength(1);
    expect(state.commits[0]).toEqual([
      {
        op: "set",
        path: `households/${hid}`,
        data: {
          name: "WG Linde",
          ownerId: "nevio",
          memberIds: ["nevio"],
          weekStartsOn: 1,
          timeZone: "Europe/Zurich",
          inviteCode: "ABC-1234",
          inviteCreatedAt: "SERVER_TIME",
          createdAt: "SERVER_TIME",
          updatedAt: "SERVER_TIME",
        },
      },
      {
        op: "set",
        path: `households/${hid}/members/nevio`,
        data: {
          displayName: "Nevio",
          initials: "NE",
          avatarColor: 3,
          role: "owner",
          joinedAt: "SERVER_TIME",
        },
      },
      {
        op: "set",
        path: "invites/ABC-1234",
        data: {
          householdId: hid,
          householdName: "WG Linde",
          ownerName: "Nevio",
          memberCount: 1,
          createdBy: "nevio",
          createdAt: "SERVER_TIME",
        },
      },
      { op: "update", path: "users/nevio", data: { householdId: hid } },
    ]);
  });

  it("checks the code on the server and tries another one on a collision", async () => {
    codes.queue = ["TAK-0001", "TAK-0002", "FRE-0003"];
    state.serverDocs.set("invites/TAK-0001", invite());
    state.serverDocs.set("invites/TAK-0002", invite());
    await createHousehold(nevio, "WG Linde");
    expect(state.serverReads).toEqual(["invites/TAK-0001", "invites/TAK-0002", "invites/FRE-0003"]);
    expect(state.commits[0][2].path).toBe("invites/FRE-0003");
  });

  it("gives up after three taken codes", async () => {
    codes.queue = ["TAK-0001", "TAK-0002", "TAK-0003"];
    for (const code of codes.queue) state.serverDocs.set(`invites/${code}`, invite());
    await expect(createHousehold(nevio, "WG Linde")).rejects.toThrow();
    expect(state.commits).toHaveLength(0);
  });

  it("retries once with a new code when the race for a code is lost", async () => {
    codes.queue = ["LOS-0001", "WIN-0002"];
    state.commitResults = [firestoreError("permission-denied"), null];
    const hid = await createHousehold(nevio, "WG Linde");
    expect(state.commits).toHaveLength(2);
    expect(state.commits[1][0].path).toBe(`households/${hid}`);
    expect(state.commits[1][2].path).toBe("invites/WIN-0002");
  });

  it("doesn't retry twice or on other errors", async () => {
    state.commitResults = [
      firestoreError("permission-denied"),
      firestoreError("permission-denied"),
    ];
    await expect(createHousehold(nevio, "WG Linde")).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect(state.commits).toHaveLength(2);

    state.commits = [];
    state.commitResults = [firestoreError("unavailable")];
    await expect(createHousehold(nevio, "WG Linde")).rejects.toMatchObject({ code: "unavailable" });
    expect(state.commits).toHaveLength(1);
  });

  it("doesn't start the batch when the server read fails (offline)", async () => {
    codes.queue = ["OFF-0001"];
    state.serverDocs.set("!invites/OFF-0001", firestoreError("unavailable"));
    await expect(createHousehold(nevio, "WG Linde")).rejects.toMatchObject({ code: "unavailable" });
    expect(state.commits).toHaveLength(0);
  });
});

describe("updateHouseholdSettings", () => {
  it("renames the invite preview together with the household", async () => {
    await updateHouseholdSettings(household, { name: "WG Linde" });
    expect(state.commits[0]).toEqual([
      { op: "update", path: "households/h1", data: { name: "WG Linde", updatedAt: "SERVER_TIME" } },
      { op: "update", path: "invites/MST-4821", data: { householdName: "WG Linde" } },
    ]);
  });

  it("leaves the invite alone for other settings", async () => {
    await updateHouseholdSettings(household, { weekStartsOn: 0, timeZone: "Europe/Berlin" });
    expect(state.commits[0]).toEqual([
      {
        op: "update",
        path: "households/h1",
        data: { weekStartsOn: 0, timeZone: "Europe/Berlin", updatedAt: "SERVER_TIME" },
      },
    ]);
  });
});

describe("getInvite", () => {
  it("reads from the server", async () => {
    state.serverDocs.set("invites/MST-4821", invite());
    await expect(getInvite("MST-4821")).resolves.toEqual(invite({ createdAt: expect.any(Date) }));
    await expect(getInvite("XYZ-0000")).resolves.toBeNull();
    expect(state.serverReads).toEqual(["invites/MST-4821", "invites/XYZ-0000"]);
  });
});

describe("regenerateInvite", () => {
  it("deletes the old invite, creates the new one and updates the household", async () => {
    codes.queue = ["NEW-1234"];
    await expect(regenerateInvite(household, nevio)).resolves.toBe("NEW-1234");
    expect(state.commits[0]).toEqual([
      { op: "delete", path: "invites/MST-4821" },
      {
        op: "set",
        path: "invites/NEW-1234",
        data: {
          householdId: "h1",
          householdName: "Musterstrasse 12",
          ownerName: "Nevio",
          memberCount: 2,
          createdBy: "nevio",
          createdAt: "SERVER_TIME",
        },
      },
      {
        op: "update",
        path: "households/h1",
        data: { inviteCode: "NEW-1234", inviteCreatedAt: "SERVER_TIME", updatedAt: "SERVER_TIME" },
      },
    ]);
  });
});

describe("joinHousehold", () => {
  beforeEach(() => {
    state.serverDocs.set("invites/MST-4821", invite());
  });

  it("re-reads the invite and writes the whole join in one batch", async () => {
    await joinHousehold(invite(), anna);
    expect(state.serverReads).toEqual(["invites/MST-4821"]);
    expect(state.commits).toHaveLength(1);
    const [household, member, user, inviteUpdate, activity] = state.commits[0];
    expect(household).toEqual({
      op: "update",
      path: "households/h1",
      data: { memberIds: { arrayUnion: ["anna"] }, updatedAt: "SERVER_TIME" },
    });
    expect(member).toEqual({
      op: "set",
      path: "households/h1/members/anna",
      data: {
        displayName: "Anna",
        initials: "AN",
        avatarColor: 6,
        role: "member",
        joinedAt: "SERVER_TIME",
        joinedWithCode: "MST-4821",
      },
    });
    expect(user).toEqual({ op: "update", path: "users/anna", data: { householdId: "h1" } });
    expect(inviteUpdate).toEqual({
      op: "update",
      path: "invites/MST-4821",
      data: { memberCount: { increment: 1 } },
    });
    expect(activity.path).toMatch(/^households\/h1\/activity\/auto\d+$/);
    expect(activity.data).toEqual({
      actorId: "anna",
      type: "member_joined",
      targetType: "member",
      targetId: "anna",
      targetTitle: "Anna",
      createdAt: "SERVER_TIME",
    });
  });

  it("doesn't write when the code is gone or expired by now", async () => {
    state.serverDocs.delete("invites/MST-4821");
    await expect(joinHousehold(invite(), anna)).rejects.toMatchObject({ reason: "not-found" });

    state.serverDocs.set(
      "invites/MST-4821",
      invite({ createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) }),
    );
    await expect(joinHousehold(invite(), anna)).rejects.toMatchObject({ reason: "expired" });
    expect(state.commits).toHaveLength(0);
  });

  it("maps a rejected batch: invite gone → not-found, still there → expired", async () => {
    state.commitResults = [firestoreError("permission-denied")];
    await expect(joinHousehold(invite(), anna)).rejects.toMatchObject({ reason: "expired" });

    state.commitResults = [firestoreError("permission-denied")];
    // Present for the check before the batch, replaced by a new code meanwhile.
    state.onCommit = () => state.serverDocs.delete("invites/MST-4821");
    await expect(joinHousehold(invite(), anna)).rejects.toMatchObject({ reason: "not-found" });
  });

  it("maps offline and other errors", async () => {
    state.commitResults = [firestoreError("unavailable")];
    const offline = await joinHousehold(invite(), anna).catch((e: unknown) => e);
    expect(offline).toBeInstanceOf(JoinError);
    expect(offline).toMatchObject({ reason: "offline" });

    state.commitResults = [firestoreError("internal")];
    await expect(joinHousehold(invite(), anna)).rejects.toMatchObject({ reason: "failed" });

    state.serverDocs.set("!invites/MST-4821", firestoreError("unavailable"));
    await expect(joinHousehold(invite(), anna)).rejects.toMatchObject({ reason: "offline" });
  });
});

describe("updateMyProfile", () => {
  it("updates profile and member doc, with initials from the new name", async () => {
    await updateMyProfile(anna, household, { displayName: "Anna Muster" });
    const next = { displayName: "Anna Muster", initials: "AM", avatarColor: 6 };
    expect(state.commits[0]).toEqual([
      { op: "update", path: "users/anna", data: next },
      { op: "update", path: "households/h1/members/anna", data: next },
    ]);
  });

  it("also updates the invite's ownerName for the owner", async () => {
    await updateMyProfile(nevio, household, { displayName: "Nevio A." });
    expect(state.commits[0][2]).toEqual({
      op: "update",
      path: "invites/MST-4821",
      data: { ownerName: "Nevio A." },
    });
  });

  it("keeps name and initials for a colour change, and skips the invite", async () => {
    await updateMyProfile(nevio, household, { avatarColor: 7 });
    const next = { displayName: "Nevio", initials: "NE", avatarColor: 7 };
    expect(state.commits[0]).toEqual([
      { op: "update", path: "users/nevio", data: next },
      { op: "update", path: "households/h1/members/nevio", data: next },
    ]);
  });
});

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/ToastProvider";
import { AuthContext, type AuthContextValue } from "../lib/auth/useAuth";
import { AppRoutes } from "../router/AppRoutes";
import type { ActivityEntry, ActivityTargetType } from "../types";
import { fakeStore, makeEvent, makeItem, makeTask, nevioProfile } from "./householdFakes";

vi.mock("../lib/firebase", () => ({ auth: {}, db: {} }));
vi.mock("../services/householdService", () =>
  import("./householdFakes").then((fakes) => fakes.householdServiceMock),
);
vi.mock("../services/memberService", () =>
  import("./householdFakes").then((fakes) => fakes.memberServiceMock),
);
vi.mock("../services/taskService", () =>
  import("./householdFakes").then((fakes) => fakes.taskServiceMock),
);
vi.mock("../services/shoppingService", () =>
  import("./householdFakes").then((fakes) => fakes.shoppingServiceMock),
);
vi.mock("../services/eventService", () =>
  import("./householdFakes").then((fakes) => fakes.eventServiceMock),
);

/** In-memory feed: the live listener gets the newest 50 of its type, older pages on request. */
const feed = vi.hoisted(() => {
  type Entry = import("../types").ActivityEntry;
  type Item = { entry: Entry; cursor: { id: string } };
  const state = {
    entries: [] as Entry[],
    error: null as Error | null,
    hold: false,
    listeners: new Set<{
      type: string | undefined;
      onChange: (items: Item[]) => void;
      onError: (e: Error) => void;
    }>(),
  };
  const ofType = (type: string | undefined) =>
    [...state.entries]
      .filter((e) => !type || e.targetType === type)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
  const toItem = (entry: Entry): Item => ({ entry, cursor: { id: entry.id } });
  return {
    state,
    deliver(listener: {
      type: string | undefined;
      onChange: (items: Item[]) => void;
      onError: (e: Error) => void;
    }) {
      if (state.error) listener.onError(state.error);
      else listener.onChange(ofType(listener.type).slice(0, 50).map(toItem));
    },
    emit() {
      for (const listener of state.listeners) this.deliver(listener);
    },
    older(type: string | undefined, after: { id: string }) {
      const list = ofType(type);
      const index = list.findIndex((e) => e.id === after.id);
      return list.slice(index + 1, index + 51).map(toItem);
    },
  };
});

vi.mock("../services/activityService", () => ({
  record: vi.fn(),
  listenToActivity: (
    _hid: string,
    type: string | undefined,
    onChange: (items: unknown[]) => void,
    onError: (e: Error) => void,
  ) => {
    const listener = { type, onChange, onError };
    feed.state.listeners.add(listener);
    if (!feed.state.hold) feed.deliver(listener);
    return () => feed.state.listeners.delete(listener);
  },
  loadOlderActivity: vi.fn(async (_hid: string, type: string | undefined, after: { id: string }) =>
    feed.older(type, after),
  ),
}));

const { loadOlderActivity } = await import("../services/activityService");

// Wednesday 30 Sept 2026, 19:02 in Zurich (`Activity.dc.html`). Only Date is faked.
const NOW = new Date("2026-09-30T17:02:00Z");

let seq = 0;
function entry(
  at: string,
  type: ActivityEntry["type"],
  overrides: Partial<ActivityEntry> = {},
): ActivityEntry {
  seq += 1;
  const targetType: Record<ActivityEntry["type"], ActivityTargetType> = {
    task_created: "task",
    task_completed: "task",
    task_assigned: "task",
    item_added: "item",
    item_purchased: "item",
    event_created: "event",
    member_joined: "member",
  };
  return {
    id: `a${String(seq).padStart(3, "0")}`,
    actorId: "anna",
    type,
    targetType: targetType[type],
    targetId: `t${seq}`,
    targetTitle: `Titel ${seq}`,
    createdAt: new Date(at),
    ...overrides,
  };
}

/** The design's feed (`Activity.dc.html`), times in UTC (Zurich is UTC+2). */
function designFeed(): ActivityEntry[] {
  return [
    entry("2026-09-30T16:40:00Z", "task_completed", {
      targetId: "bath-1",
      targetTitle: "Bad putzen",
    }),
    entry("2026-09-30T15:12:00Z", "item_added", {
      actorId: "nevio",
      targetId: "milk",
      targetTitle: "Milch",
    }),
    entry("2026-09-30T10:05:00Z", "event_created", {
      targetId: "party",
      targetTitle: "Znacht mit Freunden",
    }),
    entry("2026-09-30T05:50:00Z", "task_completed", {
      actorId: "nevio",
      targetTitle: "Altpapier rausbringen",
    }),
    entry("2026-09-29T19:10:00Z", "task_assigned", {
      actorId: "nevio",
      targetTitle: "Küche putzen",
      details: { fromId: "nevio", fromName: "Nevio", toId: "anna", toName: "Anna" },
    }),
    entry("2026-09-29T17:02:00Z", "task_completed", { targetTitle: "Bettwäsche wechseln" }),
    entry("2026-09-29T15:45:00Z", "item_purchased", { targetTitle: "Olivenöl" }),
    entry("2026-09-29T15:40:00Z", "item_purchased", { targetTitle: "WC-Papier" }),
    entry("2026-09-29T15:30:00Z", "item_purchased", { targetTitle: "Eier" }),
    entry("2026-09-29T15:20:00Z", "item_purchased", { targetTitle: "Brot" }),
    entry("2026-09-28T18:30:00Z", "event_created", {
      actorId: "nevio",
      targetTitle: "Ferien",
    }),
    entry("2026-09-28T18:15:00Z", "member_joined", { targetId: "anna", targetTitle: "Anna" }),
  ];
}

function renderActivity(entry = "/activity") {
  const auth: AuthContextValue = {
    user: { uid: nevioProfile.uid, email: nevioProfile.email },
    profile: nevioProfile,
    confirmedHouseholdId: "h1",
    initializing: false,
    login: vi.fn(),
    logout: vi.fn(),
  };
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[entry]}>
        <ToastProvider>
          <AppRoutes />
          <LocationProbe />
        </ToastProvider>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
}

const currentUrl = () => screen.getByTestId("location").textContent;
const page = () => screen.findByRole("heading", { name: "Aktivität", level: 1 }, { timeout: 3000 });
const dayHeadings = () =>
  screen.queryAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
const day = (name: RegExp) => screen.getByRole("heading", { name, level: 2 }).closest("section")!;
const rowTexts = (scope: HTMLElement) =>
  within(scope)
    .getAllByRole("listitem")
    // Without the avatar's initials or «?».
    .map((row) => row.textContent?.replace(/^(NE|AN|\?)/, ""));
const chip = (name: string) =>
  within(screen.getByRole("group", { name: "Filter" })).getByRole("button", { name });

function mockDesktop(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeAll(async () => {
  await import("../pages/ActivityPage");
});

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  fakeStore.reset();
  feed.state.entries = designFeed();
  feed.state.error = null;
  feed.state.hold = false;
  feed.state.listeners.clear();
  vi.mocked(loadOlderActivity).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.title = "";
});

describe("Aktivität — phone", () => {
  it("groups the entries by day with the designed headings (ACT-03, D80)", async () => {
    renderActivity();
    await page();
    await waitFor(() => expect(document.title).toBe("Aktivität – Household"));
    expect(dayHeadings()).toEqual([
      "HeuteMi., 30. Sept.",
      "GesternDi., 29. Sept.",
      "MontagMo., 28. Sept.",
    ]);
  });

  it("words every row as designed, purchases grouped (D77, D79)", async () => {
    fakeStore.household = { ...fakeStore.household!, name: "Musterstrasse 12" };
    renderActivity();
    await page();
    expect(rowTexts(day(/^Heute/))).toEqual([
      "Anna hat «Bad putzen» erledigt18:40",
      "Nevio hat «Milch» zum Einkauf hinzugefügt17:12",
      "Anna hat «Znacht mit Freunden» erstellt12:05",
      "Nevio hat «Altpapier rausbringen» erledigt07:50",
    ]);
    expect(rowTexts(day(/^Gestern/))).toEqual([
      "Nevio hat «Küche putzen» Anna zugewiesenVorher: Nevio21:10",
      "Anna hat «Bettwäsche wechseln» erledigt19:02",
      "Anna hat 4 Artikel gekauftBrot, Eier, WC-Papier, Olivenöl17:45",
    ]);
    expect(rowTexts(day(/^Montag/))).toEqual([
      "Nevio hat «Ferien» erstellt20:30",
      "Anna ist Musterstrasse 12 beigetreten20:15",
    ]);
  });

  it("adds sub lines from live data while the target exists (D78)", async () => {
    fakeStore.tasks = [
      makeTask({ id: "bath-1", status: "done", seriesId: "bath", seriesIndex: 1 }),
      makeTask({
        id: "bath-2",
        seriesId: "bath",
        seriesIndex: 2,
        dueDate: "2026-10-10",
        assigneeId: "nevio",
      }),
    ];
    fakeStore.items = [makeItem({ id: "milk", name: "Milch", quantity: "2 l" })];
    fakeStore.events = [makeEvent({ id: "party", title: "Znacht mit Freunden" })];
    renderActivity();
    await page();
    expect(rowTexts(day(/^Heute/)).slice(0, 3)).toEqual([
      "Anna hat «Bad putzen» erledigtNächstes Mal ist Nevio dran · Sa., 10. Okt.18:40",
      "Nevio hat «Milch» zum Einkauf hinzugefügt2 l · Lebensmittel17:12",
      "Anna hat «Znacht mit Freunden» erstelltFr., 2. Okt. · 19:30 · Alle12:05",
    ]);
  });

  it("filters by type in the URL; an empty type says «Noch nichts passiert» (ACT-08)", async () => {
    renderActivity();
    await page();
    expect(chip("Alle")).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(chip("Einkauf"));
    expect(currentUrl()).toBe("/activity?filter=item");
    await waitFor(() =>
      expect(dayHeadings()).toEqual(["HeuteMi., 30. Sept.", "GesternDi., 29. Sept."]),
    );
    expect(rowTexts(day(/^Gestern/))).toEqual([
      "Anna hat 4 Artikel gekauftBrot, Eier, WC-Papier, Olivenöl17:45",
    ]);
    feed.state.entries = feed.state.entries.filter((e) => e.targetType !== "member");
    await userEvent.click(chip("Mitglieder"));
    expect(await screen.findByText("Noch nichts passiert")).toBeInTheDocument();
    await userEvent.click(chip("Alle"));
    expect(currentUrl()).toBe("/activity");
  });

  it("opens on the filter from the URL", async () => {
    renderActivity("/activity?filter=event");
    await page();
    expect(chip("Kalender")).toHaveAttribute("aria-pressed", "true");
    expect(rowTexts(day(/^Heute/))).toEqual(["Anna hat «Znacht mit Freunden» erstellt12:05"]);
  });

  it("«Mehr laden» appends older entries and disappears at the end (ACT-04, D81)", async () => {
    feed.state.entries = Array.from({ length: 120 }, (_, i) =>
      entry(new Date(Date.UTC(2026, 8, 30, 16, 0) - i * 60_000).toISOString(), "task_created", {
        targetTitle: `Aufgabe ${i}`,
      }),
    );
    renderActivity();
    await page();
    const count = () =>
      screen.queryAllByRole("listitem").filter((row) => /Aufgabe \d+/.test(row.textContent ?? ""))
        .length;
    expect(count()).toBe(50);
    await userEvent.click(screen.getByRole("button", { name: "Mehr laden" }));
    await waitFor(() => expect(count()).toBe(100));
    // The cursor is the oldest entry shown, the 50th newest.
    expect(vi.mocked(loadOlderActivity).mock.calls[0][2]).toEqual({
      id: feed.state.entries[49].id,
    });
    await userEvent.click(screen.getByRole("button", { name: "Mehr laden" }));
    await waitFor(() => expect(count()).toBe(120));
    expect(screen.queryByRole("button", { name: "Mehr laden" })).not.toBeInTheDocument();
  });

  it("a failed «Mehr laden» shows an alert; retrying loads the page (D81)", async () => {
    feed.state.entries = Array.from({ length: 60 }, (_, i) =>
      entry(new Date(Date.UTC(2026, 8, 30, 16, 0) - i * 60_000).toISOString(), "task_created"),
    );
    vi.mocked(loadOlderActivity).mockRejectedValueOnce(new Error("unavailable"));
    renderActivity();
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Mehr laden" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Aktivität konnte nicht geladen werden.",
    );
    expect(screen.queryByRole("button", { name: "Mehr laden" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Nochmals versuchen" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(60));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("drops an older page that arrives after the filter changed", async () => {
    feed.state.entries = Array.from({ length: 60 }, (_, i) =>
      entry(new Date(Date.UTC(2026, 8, 30, 16, 0) - i * 60_000).toISOString(), "task_created"),
    );
    let resolve: (items: never[]) => void = () => {};
    vi.mocked(loadOlderActivity).mockImplementationOnce(
      () => new Promise((done) => (resolve = done as typeof resolve)),
    );
    renderActivity();
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Mehr laden" }));
    await userEvent.click(chip("Einkauf"));
    expect(await screen.findByText("Noch nichts passiert")).toBeInTheDocument();
    // The page asked for under «Alle» arrives late: it must not show under «Einkauf».
    await act(async () =>
      resolve(feed.older(undefined, { id: feed.state.entries[49].id }) as never[]),
    );
    expect(screen.getByText("Noch nichts passiert")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("shows no «Mehr laden» with fewer than 50 entries", async () => {
    renderActivity();
    await page();
    expect(screen.queryByRole("button", { name: "Mehr laden" })).not.toBeInTheDocument();
  });

  it("shows new entries live at the top", async () => {
    renderActivity();
    await page();
    feed.state.entries = [
      entry("2026-09-30T17:01:00Z", "item_purchased", { actorId: "nevio", targetTitle: "Käse" }),
      ...feed.state.entries,
    ];
    act(() => feed.emit());
    expect(rowTexts(day(/^Heute/))[0]).toBe("Nevio hat «Käse» gekauft19:01");
  });

  it("names a former member (D82)", async () => {
    feed.state.entries = [
      entry("2026-09-30T10:00:00Z", "task_completed", {
        actorId: "lea",
        targetTitle: "Bad putzen",
      }),
    ];
    renderActivity();
    await page();
    expect(rowTexts(day(/^Heute/))).toEqual(["Ehemaliges Mitglied hat «Bad putzen» erledigt12:00"]);
  });

  it("shows a skeleton while loading and an alert with retry on errors (D81)", async () => {
    feed.state.hold = true;
    renderActivity();
    await page();
    expect(screen.getByRole("status", { name: "Lädt" })).toBeInTheDocument();
    feed.state.hold = false;
    feed.state.error = new Error("unavailable");
    act(() => feed.emit());
    expect(screen.getByRole("alert")).toHaveTextContent("Aktivität konnte nicht geladen werden.");
    feed.state.error = null;
    await userEvent.click(screen.getByRole("button", { name: "Nochmals versuchen" }));
    expect(await screen.findByRole("heading", { name: /^Heute/ })).toBeInTheDocument();
  });

  it("has the back button and keeps the tab bar on phones (D76)", async () => {
    renderActivity();
    await page();
    expect(screen.getByRole("button", { name: "Zurück" })).toBeInTheDocument();
    // Sidebar and tab bar both are «Hauptnavigation»; no area is active on Aktivität.
    for (const nav of screen.getAllByRole("navigation", { name: "Hauptnavigation" })) {
      expect(within(nav).getByRole("link", { name: "Start" })).not.toHaveAttribute("aria-current");
    }
  });
});

describe("Aktivität — desktop", () => {
  beforeEach(() => mockDesktop(true));

  it("shows the title, subtitle and a type label per row", async () => {
    renderActivity();
    await page();
    expect(screen.getByText("Was im Haushalt passiert ist – live für alle.")).toBeInTheDocument();
    const rows = rowTexts(day(/^Heute/));
    expect(rows[0]).toBe("Anna hat «Bad putzen» erledigtAufgabe18:40");
    expect(rows[1]).toBe("Nevio hat «Milch» zum Einkauf hinzugefügtEinkauf17:12");
    expect(rows[2]).toBe("Anna hat «Znacht mit Freunden» erstelltTermin12:05");
    expect(rowTexts(day(/^Montag/))[1]).toBe("Anna ist Musterstrasse 12 beigetretenMitglied20:15");
  });
});

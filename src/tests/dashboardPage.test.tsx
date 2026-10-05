import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/ToastProvider";
import { allDayToStored } from "../domain/eventTime";
import { AuthContext, type AuthContextValue } from "../lib/auth/useAuth";
import { AppRoutes } from "../router/AppRoutes";
import type { ShoppingItem, Task } from "../types";
import {
  fakeStore,
  makeEvent,
  makeItem,
  makeMember,
  makeTask,
  nevioProfile,
  shoppingServiceMock,
  taskServiceMock,
} from "./householdFakes";

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
vi.mock("../services/activityService", () =>
  import("./householdFakes").then((fakes) => fakes.activityServiceMock),
);

// Wednesday 30 Sept 2026, 08:12 in Zurich (`Dashboard.dc.html`). Only Date is faked.
const NOW = new Date("2026-09-30T06:12:00Z");
const TODAY = "2026-09-30";

function renderStart(entry = "/dashboard") {
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
const page = () =>
  screen.findByRole("heading", { name: /^Guten Morgen/, level: 1 }, { timeout: 3000 });
const section = (name: RegExp | string) =>
  screen.getByRole("heading", { name, level: 2 }).closest("section")!;
const taskBoxes = (scope: HTMLElement) =>
  within(scope)
    .queryAllByRole("checkbox", { name: /^Abhaken: / })
    .map((box) => box.getAttribute("aria-label")?.replace("Abhaken: ", ""));

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

/** The design's tasks: one overdue, two today, done ones for «Kürzlich erledigt». */
function exampleTasks(): Task[] {
  return [
    makeTask({
      id: "water",
      title: "Pflanzen giessen",
      dueDate: "2026-09-29",
      assigneeId: "nevio",
      recurrence: { freq: "daily", interval: 4 },
      seriesId: "water",
      seriesIndex: 3,
    }),
    makeTask({ id: "paper", title: "Altpapier rausbringen", dueDate: TODAY, assigneeId: "nevio" }),
    makeTask({
      id: "kitchen",
      title: "Küche putzen",
      dueDate: TODAY,
      assigneeId: "anna",
      priority: "high",
    }),
    makeTask({ id: "bath", title: "Bad putzen", dueDate: "2026-10-03", assigneeId: "anna" }),
    makeTask({
      id: "sheets",
      title: "Bettwäsche wechseln",
      status: "done",
      dueDate: "2026-09-29",
      completedAt: new Date("2026-09-29T17:02:00Z"),
      completedBy: "anna",
    }),
  ];
}

function exampleItems(): ShoppingItem[] {
  return [
    makeItem({ id: "milk", name: "Milch", quantity: "2 l" }),
    makeItem({ id: "coffee", name: "Kaffeebohnen" }),
    makeItem({ id: "tabs", name: "Geschirrspültabs", category: "household" }),
    makeItem({ id: "ibu", name: "Ibuprofen", category: "pharmacy" }),
    makeItem({ id: "banana", name: "Bananen", quantity: "6" }),
    makeItem({ id: "bulbs", name: "Glühbirnen E27", category: "other" }),
    makeItem({ id: "bread", name: "Brot", checked: true }),
  ];
}

function exampleEvents() {
  return [
    makeEvent({
      id: "delivery",
      title: "Möbellieferung",
      category: "home",
      allDay: true,
      ...allDayToStored("2026-10-01", "2026-10-01"),
    }),
    makeEvent({ id: "party", title: "Znacht mit Freunden", category: "social" }),
    makeEvent({
      id: "cleaning",
      title: "Grossputz",
      category: "home",
      start: new Date("2026-09-19T08:00:00Z"),
      end: new Date("2026-09-19T10:00:00Z"),
      recurrence: { freq: "weekly", interval: 2, byWeekday: [6] },
    }),
    makeEvent({
      id: "later",
      title: "Später",
      start: new Date("2026-10-08T08:00:00Z"),
      end: new Date("2026-10-08T09:00:00Z"),
    }),
  ];
}

beforeAll(async () => {
  await import("../pages/DashboardPage");
});

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  fakeStore.reset();
  fakeStore.tasks = exampleTasks();
  fakeStore.items = exampleItems();
  fakeStore.events = exampleEvents();
  for (const mock of [taskServiceMock, shoppingServiceMock]) {
    for (const fn of Object.values(mock)) {
      if (typeof fn === "function" && "mockReset" in fn) fn.mockReset();
    }
  }
  taskServiceMock.completeTask.mockImplementation(async (_hid, task, actorId) => {
    fakeStore.setTasks(
      fakeStore.tasks.map((t) =>
        t.id === task.id
          ? { ...t, status: "done", completedAt: new Date(), completedBy: actorId }
          : t,
      ),
    );
  });
  taskServiceMock.reopenTask.mockImplementation(async (_hid, task) => {
    fakeStore.setTasks(
      fakeStore.tasks.map((t) =>
        t.id === task.id ? { ...t, status: "open", completedAt: undefined } : t,
      ),
    );
  });
  shoppingServiceMock.checkItem.mockImplementation(async (_hid, item) => {
    fakeStore.setItems(
      fakeStore.items.map((i) => (i.id === item.id ? { ...i, checked: true } : i)),
    );
  });
  shoppingServiceMock.uncheckItem.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.title = "";
});

describe("Start — phone", () => {
  it("shows date, greeting, summary and the sections in the designed order", async () => {
    renderStart();
    await page();
    await waitFor(() => expect(document.title).toBe("Start – Household"));
    expect(screen.getByText("Mittwoch, 30. September")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Guten Morgen, Nevio");
    // Tasks 1 overdue + 2 today, 6 open items, «Möbellieferung», «Znacht», «Grossputz».
    expect(
      screen.getByText("3 Aufgaben heute · 6 Artikel offen · 3 Termine diese Woche"),
    ).toBeInTheDocument();
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Überfällig",
      "Heute2 offen",
      "Einkauf6 offen",
      "DemnächstNächste 7 Tage",
      "Kürzlich erledigt",
    ]);
  });

  it("lists overdue and today's tasks of both members (DSH-02, DSH-03)", async () => {
    renderStart();
    await page();
    const overdue = section("Überfällig");
    expect(taskBoxes(overdue)).toEqual(["Pflanzen giessen"]);
    expect(overdue).toHaveTextContent("Gestern");
    expect(overdue).toHaveTextContent("Alle 4 Tage");
    const today = section(/^Heute/);
    expect(taskBoxes(today)).toEqual(["Küche putzen", "Altpapier rausbringen"]);
    const kitchen = screen.getByRole("checkbox", { name: "Abhaken: Küche putzen" }).closest("li")!;
    expect(kitchen).toHaveTextContent("Anna");
    expect(kitchen).toHaveTextContent("Hoch");
    const paper = screen
      .getByRole("checkbox", { name: "Abhaken: Altpapier rausbringen" })
      .closest("li")!;
    expect(paper).not.toHaveTextContent("Niedrig");
  });

  it("an unassigned task says «Nicht zugewiesen» and has no avatar (D73)", async () => {
    fakeStore.tasks = [makeTask({ title: "Fenster putzen", dueDate: TODAY })];
    renderStart();
    await page();
    const row = screen.getByRole("checkbox", { name: "Abhaken: Fenster putzen" }).closest("li")!;
    expect(row).toHaveTextContent("Nicht zugewiesen");
    expect(within(row).queryByRole("img")).not.toBeInTheDocument();
  });

  it("hides «Überfällig» when nothing is overdue", async () => {
    fakeStore.tasks = exampleTasks().filter((task) => task.id !== "water");
    renderStart();
    await page();
    expect(screen.queryByRole("heading", { name: "Überfällig" })).not.toBeInTheDocument();
  });

  it("ticks a task off after 700 ms with «Rückgängig»; it moves to «Kürzlich erledigt»", async () => {
    renderStart();
    await page();
    await userEvent.click(screen.getByRole("checkbox", { name: "Abhaken: Altpapier rausbringen" }));
    await waitFor(() => expect(taskServiceMock.completeTask).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
    expect(taskServiceMock.completeTask.mock.calls[0][1]).toMatchObject({ id: "paper" });
    expect(taskBoxes(section(/^Heute/))).toEqual(["Küche putzen"]);
    const recent = section("Kürzlich erledigt");
    expect(within(recent).getAllByRole("listitem")[0]).toHaveTextContent(
      "Nevio hat «Altpapier rausbringen» erledigtGerade eben",
    );
    expect(screen.getByText("«Altpapier rausbringen» erledigt")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Rückgängig" }));
    expect(taskServiceMock.reopenTask.mock.calls[0][1]).toMatchObject({ id: "paper" });
  });

  it("tapping a task row opens «Aufgabe bearbeiten» (D73)", async () => {
    renderStart();
    await page();
    await userEvent.click(screen.getByText("Küche putzen"));
    expect(await screen.findByRole("dialog", { name: "Aufgabe bearbeiten" })).toBeInTheDocument();
  });

  it("«Alles erledigt 🎉» after today's tasks are done, with the next task (D67, D68)", async () => {
    fakeStore.tasks = [
      makeTask({ title: "Altpapier", dueDate: TODAY, status: "done", completedAt: NOW }),
      makeTask({ title: "Bad putzen", dueDate: "2026-10-03" }),
    ];
    renderStart();
    await page();
    const today = section(/^Heute/);
    expect(today).toHaveTextContent("Erledigt");
    expect(within(today).getByText("Alles erledigt 🎉")).toBeInTheDocument();
    expect(
      within(today).getByText("Gut gemacht, ihr zwei. Als Nächstes: «Bad putzen» am Samstag."),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Heute nichts mehr zu tun · /)).toBeInTheDocument();
    await userEvent.click(within(today).getByRole("button", { name: "Aufgabe hinzufügen" }));
    expect(await screen.findByRole("dialog", { name: "Neue Aufgabe" })).toBeInTheDocument();
  });

  it("«Heute steht nichts an.» on a day with nothing due, or with only overdue tasks (D67)", async () => {
    fakeStore.tasks = [makeTask({ title: "Später", dueDate: "2026-10-05" })];
    renderStart();
    await page();
    expect(within(section(/^Heute/)).getByText("Heute steht nichts an.")).toBeInTheDocument();
    expect(screen.queryByText("Alles erledigt 🎉")).not.toBeInTheDocument();

    fakeStore.setTasks([
      makeTask({ title: "Heute erledigt", dueDate: TODAY, status: "done", completedAt: NOW }),
      makeTask({ title: "Überfällig", dueDate: "2026-09-28" }),
    ]);
    await waitFor(() =>
      expect(within(section(/^Heute/)).getByText("Heute steht nichts an.")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Alles erledigt 🎉")).not.toBeInTheDocument();
  });

  it("shows the first five open items; ticking one checks it (DSH-05)", async () => {
    renderStart();
    await page();
    const shopping = section(/^Einkauf/);
    expect(
      within(shopping)
        .getAllByRole("checkbox")
        .map((box) => box.getAttribute("aria-label")),
    ).toEqual([
      "Milch als gekauft markieren",
      "Kaffeebohnen als gekauft markieren",
      "Bananen als gekauft markieren",
      "Geschirrspültabs als gekauft markieren",
      "Ibuprofen als gekauft markieren",
    ]);
    const milk = within(shopping).getByText("Milch").closest("li")!;
    expect(milk).toHaveTextContent("2 l");
    expect(milk).toHaveTextContent("Lebensmittel");
    await userEvent.click(within(shopping).getByRole("checkbox", { name: /^Milch/ }));
    await waitFor(() => expect(shoppingServiceMock.checkItem).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
    expect(screen.getByText("«Milch» gekauft")).toBeInTheDocument();
    expect(section(/^Einkauf/)).toHaveTextContent("5 offen");
  });

  it("«Alles gekauft» and «Nichts auf der Liste.» when everything is bought (D70)", async () => {
    fakeStore.items = [makeItem({ name: "Brot", checked: true })];
    renderStart();
    await page();
    const shopping = section(/^Einkauf/);
    expect(shopping).toHaveTextContent("Alles gekauft");
    expect(within(shopping).getByText("Nichts auf der Liste.")).toBeInTheDocument();
  });

  it("«Artikel hinzufügen» opens the Schnellerfassung on «Einkauf» (B7)", async () => {
    renderStart();
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Artikel hinzufügen" }));
    const sheet = await screen.findByRole("dialog", { name: "Schnellerfassung" });
    expect(within(sheet).getByRole("radio", { name: "Einkauf" })).toBeChecked();
  });

  it("shows the next 7 days incl. the next «Grossputz» and links to the occurrence (DSH-04)", async () => {
    renderStart();
    await page();
    const upcoming = section(/^Demnächst/);
    // «Später» (8 Oct) is beyond the 7 days.
    const rows = within(upcoming).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^Do1Möbellieferung\s?Zuhause· Morgen · Ganztägig/),
      expect.stringMatching(/^Fr2Znacht mit Freunden\s?Freizeit· 19:30–22:30/),
      expect.stringMatching(/^Sa3Grossputz\s?Zuhause· 10:00–12:00Alle 2 Wochen/),
    ]);
    await userEvent.click(within(upcoming).getByRole("button", { name: /Grossputz/ }));
    await waitFor(() => expect(currentUrl()).toBe("/calendar?event=cleaning%402026-10-03"), {
      timeout: 3000,
    });
  });

  it("«Nichts geplant» without events in the next 7 days (D71)", async () => {
    fakeStore.events = [];
    renderStart();
    await page();
    const upcoming = section(/^Demnächst/);
    expect(within(upcoming).getByText("Nichts geplant")).toBeInTheDocument();
    expect(
      within(upcoming).getByText("In den nächsten 7 Tagen steht nichts an."),
    ).toBeInTheDocument();
  });

  it("lists the last five completions with who and when (DSH-06, D72, D82)", async () => {
    fakeStore.tasks = [
      ...[1, 2, 3, 4, 5, 6].map((day) =>
        makeTask({
          title: `Aufgabe ${day}`,
          status: "done",
          completedAt: new Date(`2026-09-2${day}T08:00:00Z`),
          completedBy: day === 4 ? "lea" : "anna",
        }),
      ),
      makeTask({
        title: "Heute früh",
        status: "done",
        completedAt: new Date("2026-09-30T05:50:00Z"),
        completedBy: "nevio",
      }),
    ];
    renderStart();
    await page();
    const rows = within(section("Kürzlich erledigt")).getAllByRole("listitem");
    // Without the avatar's initials (or «?» for a former member).
    expect(rows.map((row) => row.textContent?.replace(/^(NE|AN|\?)/, ""))).toEqual([
      "Nevio hat «Heute früh» erledigt07:50",
      "Anna hat «Aufgabe 6» erledigtSa., 26. Sept.",
      "Anna hat «Aufgabe 5» erledigtFr., 25. Sept.",
      "Ehemaliges Mitglied hat «Aufgabe 4» erledigtDo., 24. Sept.",
      "Anna hat «Aufgabe 3» erledigtMi., 23. Sept.",
    ]);
  });

  it("«Noch nichts erledigt.» without completions; «Aktivität ›» opens the feed (D72, D76)", async () => {
    fakeStore.tasks = [];
    renderStart();
    await page();
    const recent = section("Kürzlich erledigt");
    expect(within(recent).getByText("Noch nichts erledigt.")).toBeInTheDocument();
    await userEvent.click(within(recent).getByRole("button", { name: "Aktivität" }));
    await waitFor(() => expect(currentUrl()).toBe("/activity"), { timeout: 3000 });
  });

  it("the account menu leads to «Aktivität» (D76)", async () => {
    renderStart();
    await page();
    await userEvent.click(screen.getAllByRole("button", { name: "Kontomenü" })[0]);
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual(["Profil", "Aktivität", "Haushalt", "Abmelden"]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Aktivität" }));
    await waitFor(() => expect(currentUrl()).toBe("/activity"), { timeout: 3000 });
  });

  it("section links open their areas (B11)", async () => {
    renderStart();
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Alle Aufgaben" }));
    // The router keeps the old screen while the lazy page loads (a transition).
    await waitFor(() => expect(currentUrl()).toBe("/tasks"), { timeout: 3000 });
  });

  it("shows the skeleton until tasks, items and events have loaded (D74)", async () => {
    fakeStore.holdEvents = true;
    renderStart();
    await page();
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Start wird geladen");
    expect(screen.queryByRole("heading", { name: /^Heute/ })).not.toBeInTheDocument();
    fakeStore.holdEvents = false;
    fakeStore.emitEvents();
    expect(await screen.findByRole("heading", { name: /^Heute/ })).toBeInTheDocument();
    expect(screen.queryByText("Start wird geladen")).not.toBeInTheDocument();
  });

  it("a failed list shows its alert with «Nochmals versuchen»; the others work (D74)", async () => {
    fakeStore.itemsError = new Error("permission-denied");
    renderStart();
    await page();
    const shopping = section("Einkauf");
    expect(within(shopping).getByRole("alert")).toHaveTextContent(
      "Einkauf konnte nicht geladen werden.",
    );
    expect(screen.getByText("3 Aufgaben heute · 3 Termine diese Woche")).toBeInTheDocument();
    expect(taskBoxes(section(/^Heute/))).toHaveLength(2);
    fakeStore.itemsError = null;
    await userEvent.click(within(shopping).getByRole("button", { name: "Nochmals versuchen" }));
    expect(await within(section(/^Einkauf/)).findByText("Milch")).toBeInTheDocument();
  });

  it("a failed task list shows the alert in «Heute» and hides overdue and recent (D74)", async () => {
    fakeStore.tasksError = new Error("unavailable");
    renderStart();
    await page();
    expect(within(section("Heute")).getByRole("alert")).toHaveTextContent(
      "Aufgaben konnten nicht geladen werden.",
    );
    expect(screen.queryByRole("heading", { name: "Überfällig" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kürzlich erledigt" })).not.toBeInTheDocument();
  });

  it("tapping an item row opens «Artikel bearbeiten» (D73)", async () => {
    renderStart();
    await page();
    await userEvent.click(within(section(/^Einkauf/)).getByText("Kaffeebohnen"));
    expect(await screen.findByRole("dialog", { name: "Artikel bearbeiten" })).toBeInTheDocument();
  });

  it("a failed event list shows its alert in «Demnächst» (D74)", async () => {
    fakeStore.eventsError = new Error("unavailable");
    renderStart();
    await page();
    expect(within(section(/^Demnächst/)).getByRole("alert")).toHaveTextContent(
      "Kalender konnte nicht geladen werden.",
    );
    expect(screen.getByText("3 Aufgaben heute · 6 Artikel offen")).toBeInTheDocument();
  });

  it("greets by time of day (DSH-01)", async () => {
    vi.setSystemTime(new Date("2026-09-30T17:30:00Z")); // 19:30
    renderStart();
    expect(
      await screen.findByRole(
        "heading",
        { name: "Guten Abend, Nevio", level: 1 },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
  });

  it("praises three or more members as «ihr alle» (D68)", async () => {
    fakeStore.members = [
      ...fakeStore.members,
      makeMember({ uid: "mia", displayName: "Mia", initials: "MI" }),
    ];
    fakeStore.tasks = [makeTask({ dueDate: TODAY, status: "done", completedAt: NOW })];
    renderStart();
    await page();
    expect(screen.getByText("Gut gemacht, ihr alle.")).toBeInTheDocument();
  });
});

describe("Start — desktop", () => {
  beforeEach(() => mockDesktop(true));

  it("shows three columns with the member avatars, no presence (D75)", async () => {
    renderStart();
    await page();
    // The header stack: one avatar per member, no «… ist online».
    const avatars = screen.getByRole("heading", { level: 1 }).parentElement!.nextElementSibling!;
    expect(
      within(avatars as HTMLElement)
        .getAllByRole("img")
        .map((img) => img.getAttribute("aria-label")),
    ).toEqual(["Nevio", "Anna"]);
    expect(screen.queryByText(/ist online/)).not.toBeInTheDocument();
    // Headers sit inside the cards; «Demnächst» says «7 Tage».
    expect(section(/^Demnächst/)).toHaveTextContent("Demnächst7 Tage");
    const upcoming = section(/^Demnächst/);
    expect(within(upcoming).getByText("Alle 2 Wochen")).toBeInTheDocument();
    // Desktop «Heute» rows: title only, the assignee as avatar.
    const kitchen = screen.getByRole("checkbox", { name: "Abhaken: Küche putzen" }).closest("li")!;
    expect(within(kitchen).queryByText("Anna")).not.toBeInTheDocument();
    expect(within(kitchen).getByRole("img", { name: "Anna" })).toBeInTheDocument();
  });

  it("shows the three-column skeleton while loading (D74)", async () => {
    fakeStore.holdTasks = true;
    renderStart();
    await page();
    expect(screen.getByText("Start wird geladen")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("the «Artikel hinzufügen» field opens the Schnellerfassung on «Einkauf» (D75)", async () => {
    renderStart();
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Artikel hinzufügen" }));
    const dialog = await screen.findByRole("dialog", { name: "Schnellerfassung" });
    expect(within(dialog).getByRole("radio", { name: "Einkauf" })).toBeChecked();
  });

  it("«Alles erledigt» on desktop names only the next task (D68)", async () => {
    fakeStore.tasks = [
      makeTask({ title: "Altpapier", dueDate: TODAY, status: "done", completedAt: NOW }),
      makeTask({ title: "Bad putzen", dueDate: "2026-10-01" }),
    ];
    renderStart();
    await page();
    expect(screen.getByText("Als Nächstes: «Bad putzen» morgen.")).toBeInTheDocument();
    expect(screen.queryByText(/Gut gemacht/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aufgabe hinzufügen" })).not.toBeInTheDocument();
  });
});

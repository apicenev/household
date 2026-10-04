import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/ToastProvider";
import { AuthContext, type AuthContextValue } from "../lib/auth/useAuth";
import { AppRoutes } from "../router/AppRoutes";
import type { NewTaskInput, Task } from "../types";
import { fakeStore, makeTask, nevioProfile, taskServiceMock } from "./householdFakes";

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

// Wednesday 30 Sept 2026, 10:00 in Zurich. Only Date is faked; timers stay real.
const NOW = new Date("2026-09-30T08:00:00Z");
const TODAY = "2026-09-30";

function renderTasks(entry = "/tasks") {
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
// The lazy page can take more than findBy's default 1 s to load under full-suite load.
const page = () => screen.findByRole("heading", { name: "Aufgaben", level: 1 }, { timeout: 3000 });
const groupHeadings = () =>
  screen
    .queryAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent)
    .filter((text) => text && /^(Überfällig|Heute|Demnächst|Ohne Datum)/.test(text));
const chip = (name: string) =>
  within(screen.getByRole("group", { name: "Filter" })).getByRole("button", { name });
const rowTitles = () =>
  screen
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

/** The example list: one per group, plus a second task today with high priority. */
function exampleTasks(): Task[] {
  return [
    makeTask({
      id: "water",
      title: "Pflanzen giessen",
      dueDate: "2026-09-29",
      assigneeId: "nevio",
    }),
    makeTask({ id: "paper", title: "Altpapier rausbringen", dueDate: TODAY, assigneeId: "nevio" }),
    makeTask({
      id: "kitchen",
      title: "Küche putzen",
      dueDate: TODAY,
      assigneeId: "anna",
      priority: "high",
    }),
    makeTask({
      id: "sheets",
      title: "Bettwäsche wechseln",
      dueDate: "2026-10-03",
      assigneeId: "anna",
      priority: "medium",
    }),
    makeTask({ id: "landlord", title: "Vermieter anrufen" }),
  ];
}

/** Completing / reopening / creating update the fake store like latency compensation. */
function optimisticWrites() {
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
        t.id === task.id
          ? { ...t, status: "open", completedAt: undefined, completedBy: undefined }
          : t,
      ),
    );
  });
  let created = 0;
  taskServiceMock.createTask.mockImplementation((_hid, input: NewTaskInput) => {
    created += 1;
    const id = `new${created}`;
    fakeStore.setTasks([...fakeStore.tasks, makeTask({ id, ...input })]);
    return { id, committed: Promise.resolve() };
  });
  taskServiceMock.updateTask.mockResolvedValue(undefined);
  taskServiceMock.deleteTask.mockImplementation(async (_hid, task) => {
    fakeStore.setTasks(fakeStore.tasks.filter((t) => t.id !== task.id));
  });
  taskServiceMock.deleteOccurrence.mockResolvedValue(undefined);
  taskServiceMock.deleteSeries.mockResolvedValue(undefined);
}

const weeklySat = { freq: "weekly" as const, interval: 1, byWeekday: [6] };

/** «Bad putzen», weekly on Saturday, rotating Nevio → Anna, due Sat 3 Oct (Phase 4). */
function bathroom(overrides: Partial<Task> = {}): Task {
  return makeTask({
    id: "bath",
    title: "Bad putzen",
    dueDate: "2026-10-03",
    assigneeId: "nevio",
    recurrence: weeklySat,
    rotation: { memberIds: ["nevio", "anna"], index: 0 },
    seriesId: "bath",
    seriesIndex: 1,
    ...overrides,
  });
}

beforeAll(async () => {
  await import("../pages/TasksPage");
  await import("../pages/HouseholdPage");
});

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  fakeStore.reset();
  fakeStore.tasks = exampleTasks();
  for (const fn of Object.values(taskServiceMock)) {
    if (typeof fn === "function" && "mockReset" in fn) fn.mockReset();
  }
  optimisticWrites();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.title = "";
});

describe("Aufgaben list", () => {
  it("groups open tasks in order, sorted by date and priority", async () => {
    renderTasks();
    await page();
    // The title is set in an effect, which can run after the heading shows up.
    await waitFor(() => expect(document.title).toBe("Aufgaben – Household"));
    expect(groupHeadings()).toEqual(["Überfällig1", "Heute2", "Demnächst1", "Ohne Datum1"]);
    expect(rowTitles()).toEqual([
      "Pflanzen giessen",
      "Küche putzen",
      "Altpapier rausbringen",
      "Bettwäsche wechseln",
      "Vermieter anrufen",
    ]);
  });

  it("shows due labels (none in «Heute» on phones), priorities and assignees", async () => {
    renderTasks();
    await page();
    const water = screen
      .getByRole("checkbox", { name: "Abhaken: Pflanzen giessen" })
      .closest("li")!;
    expect(water).toHaveTextContent("Gestern");
    expect(within(water).getByText("Niedrig")).toBeInTheDocument();
    expect(within(water).getByRole("img", { name: "Nevio" })).toBeInTheDocument();
    const paper = screen
      .getByRole("checkbox", { name: "Abhaken: Altpapier rausbringen" })
      .closest("li")!;
    expect(paper).not.toHaveTextContent("Heute");
    const sheets = screen
      .getByRole("checkbox", { name: "Abhaken: Bettwäsche wechseln" })
      .closest("li")!;
    expect(sheets).toHaveTextContent("Sa., 3. Okt.");
    expect(sheets).toHaveTextContent("Mittel");
    const landlord = screen
      .getByRole("checkbox", { name: "Abhaken: Vermieter anrufen" })
      .closest("li")!;
    expect(within(landlord).getByRole("img", { name: "Nicht zugewiesen" })).toBeInTheDocument();
  });

  it("filters with chips and keeps them in the URL", async () => {
    renderTasks();
    await page();
    await userEvent.click(chip("Meine"));
    expect(currentUrl()).toBe("/tasks?assignee=nevio");
    expect(rowTitles()).toEqual(["Pflanzen giessen", "Altpapier rausbringen"]);
    expect(chip("Meine")).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(chip("Anna"));
    expect(currentUrl()).toBe("/tasks?assignee=anna");
    await userEvent.click(chip("Heute"));
    expect(rowTitles()).toEqual(["Küche putzen"]);
    expect(currentUrl()).toBe("/tasks?assignee=anna&due=today");

    await userEvent.click(chip("Anna"));
    expect(currentUrl()).toBe("/tasks?due=today");
    expect(rowTitles()).toEqual(["Küche putzen", "Altpapier rausbringen"]);
  });

  it("selects the chips of a URL and ignores unknown values", async () => {
    renderTasks("/tasks?due=week&priority=high");
    await page();
    expect(chip("Diese Woche")).toHaveAttribute("aria-pressed", "true");
    expect(chip("Priorität Hoch")).toHaveAttribute("aria-pressed", "true");
    expect(rowTitles()).toEqual(["Küche putzen"]);
  });

  it("ignores the uid of someone who isn't a member", async () => {
    renderTasks("/tasks?assignee=lea");
    await page();
    expect(rowTitles()).toHaveLength(5);
    expect(chip("Nicht zugewiesen")).toHaveAttribute("aria-pressed", "false");
  });

  it("«Nicht zugewiesen» includes a task of a former member (D23)", async () => {
    fakeStore.tasks = [...exampleTasks(), makeTask({ title: "Von Lea", assigneeId: "lea" })];
    renderTasks("/tasks?assignee=none");
    await page();
    expect(rowTitles()).toEqual(["Vermieter anrufen", "Von Lea"]);
  });

  it("shows «Keine passenden Aufgaben» and resets the filters", async () => {
    renderTasks("/tasks?assignee=anna&due=overdue");
    await page();
    expect(screen.getByRole("heading", { name: "Keine passenden Aufgaben" })).toBeInTheDocument();
    expect(screen.getByText("Entferne einen Filter.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Filter zurücksetzen" }));
    expect(currentUrl()).toBe("/tasks");
    expect(rowTitles()).toHaveLength(5);
  });

  it("shows «Noch keine Aufgaben» for a new household (D12)", async () => {
    fakeStore.tasks = [];
    renderTasks();
    await page();
    expect(screen.getByRole("heading", { name: "Noch keine Aufgaben" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Erledigt/ })).not.toBeInTheDocument();
  });

  it("shows «Alles erledigt 🎉» with «Erledigt (n)» below it (D12, B5)", async () => {
    fakeStore.tasks = [
      makeTask({
        title: "Bad putzen",
        status: "done",
        completedAt: new Date("2026-09-29T18:00:00Z"),
        completedBy: "anna",
      }),
    ];
    renderTasks();
    await page();
    expect(screen.getByRole("heading", { name: "Alles erledigt 🎉" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Erledigt (1)" })).toBeInTheDocument();
  });

  it("shows a skeleton while loading and an error with retry (D13, D14)", async () => {
    fakeStore.holdTasks = true;
    renderTasks();
    await page();
    expect(screen.getByRole("status", { name: "Lädt" })).toBeInTheDocument();
    act(() => {
      fakeStore.tasksError = new Error("boom");
      fakeStore.emitTasks();
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Aufgaben konnten nicht geladen werden.");
    fakeStore.tasksError = null;
    fakeStore.holdTasks = false;
    await userEvent.click(screen.getByRole("button", { name: "Nochmals versuchen" }));
    expect(rowTitles()).toHaveLength(5);
  });

  it("updates live when another member changes the tasks", async () => {
    renderTasks();
    await page();
    act(() => fakeStore.setTasks([...fakeStore.tasks, makeTask({ title: "Neu von Anna" })]));
    expect(rowTitles()).toContain("Neu von Anna");
    act(() => fakeStore.setTasks(fakeStore.tasks.filter((t) => t.id !== "water")));
    expect(rowTitles()).not.toContain("Pflanzen giessen");
  });
});

describe("check-off (B6)", () => {
  it("ticks at once, completes after 700 ms and offers «Rückgängig»", async () => {
    renderTasks();
    await page();
    const box = screen.getByRole("checkbox", { name: "Abhaken: Pflanzen giessen" });
    await userEvent.click(box);
    expect(box).toHaveAttribute("aria-checked", "true");
    expect(taskServiceMock.completeTask).not.toHaveBeenCalled();
    await waitFor(() => expect(taskServiceMock.completeTask).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
    expect(taskServiceMock.completeTask.mock.calls[0][1]).toMatchObject({ id: "water" });
    expect(rowTitles()).not.toContain("Pflanzen giessen");

    expect(screen.getByText("«Pflanzen giessen» erledigt")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Rückgängig" }));
    expect(taskServiceMock.reopenTask.mock.calls[0][1]).toMatchObject({ id: "water" });
    expect(rowTitles()).toContain("Pflanzen giessen");
  });

  it("a second tap within 700 ms cancels without writing", async () => {
    renderTasks();
    await page();
    const box = screen.getByRole("checkbox", { name: "Abhaken: Küche putzen" });
    await userEvent.click(box);
    await userEvent.click(box);
    expect(box).toHaveAttribute("aria-checked", "false");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(taskServiceMock.completeTask).not.toHaveBeenCalled();
  });

  it("leaving the page within 700 ms writes the completion right away", async () => {
    renderTasks();
    await page();
    await userEvent.click(screen.getByRole("checkbox", { name: "Abhaken: Küche putzen" }));
    await userEvent.click(screen.getAllByRole("link", { name: "Start" })[0]);
    expect(currentUrl()).toBe("/dashboard");
    expect(taskServiceMock.completeTask).toHaveBeenCalledTimes(1);
    expect(taskServiceMock.completeTask.mock.calls[0][1]).toMatchObject({ id: "kitchen" });
  });

  it("a new completion replaces the previous toast; undo reopens the latest", async () => {
    renderTasks();
    await page();
    await userEvent.click(screen.getByRole("checkbox", { name: "Abhaken: Pflanzen giessen" }));
    await screen.findByText("«Pflanzen giessen» erledigt", undefined, { timeout: 2000 });
    await userEvent.click(screen.getByRole("checkbox", { name: "Abhaken: Küche putzen" }));
    await screen.findByText("«Küche putzen» erledigt", undefined, { timeout: 2000 });
    expect(screen.queryByText("«Pflanzen giessen» erledigt")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Rückgängig" })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Rückgängig" }));
    expect(taskServiceMock.reopenTask.mock.calls[0][1]).toMatchObject({ id: "kitchen" });
  });

  it("stays silent when the task was completed by someone else (D21)", async () => {
    taskServiceMock.completeTask.mockImplementation(async (_hid, task) => {
      // Anna completed it first; our batch is rejected.
      fakeStore.setTasks(
        fakeStore.tasks.map((t) =>
          t.id === task.id
            ? { ...t, status: "done", completedAt: new Date(), completedBy: "anna" }
            : t,
        ),
      );
      throw Object.assign(new Error("denied"), { code: "permission-denied" });
    });
    renderTasks();
    await page();
    await userEvent.click(screen.getByRole("checkbox", { name: "Abhaken: Pflanzen giessen" }));
    await waitFor(() => expect(taskServiceMock.completeTask).toHaveBeenCalled(), { timeout: 2000 });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(
      screen.queryByText("Das hat nicht geklappt. Versuch es nochmals."),
    ).not.toBeInTheDocument();
  });

  it("reports a rejected completion of a task that is still open (D21)", async () => {
    taskServiceMock.completeTask.mockRejectedValue(
      Object.assign(new Error("denied"), { code: "permission-denied" }),
    );
    renderTasks();
    await page();
    await userEvent.click(screen.getByRole("checkbox", { name: "Abhaken: Pflanzen giessen" }));
    expect(
      await screen.findByText("Das hat nicht geklappt. Versuch es nochmals.", undefined, {
        timeout: 2500,
      }),
    ).toBeInTheDocument();
  });

  it("shows «Sync läuft» only after a write has been pending for a second (B14)", async () => {
    fakeStore.tasks = [makeTask({ title: "Offline", hasPendingWrites: true })];
    renderTasks();
    await page();
    const box = screen.getByRole("checkbox", { name: "Abhaken: Offline" });
    expect(box).not.toHaveAttribute("aria-busy");
    await waitFor(() => expect(box).toHaveAttribute("aria-busy", "true"), { timeout: 2000 });
    act(() => fakeStore.setTasks([{ ...fakeStore.tasks[0], hasPendingWrites: false }]));
    expect(box).not.toHaveAttribute("aria-busy");
  });
});

describe("«Erledigt (n)» (B5)", () => {
  it("lists the last 30 days, newest first, and reopens", async () => {
    fakeStore.tasks = [
      ...exampleTasks(),
      makeTask({
        id: "d1",
        title: "Bad putzen",
        status: "done",
        completedAt: new Date("2026-09-29T17:00:00Z"),
        completedBy: "anna",
      }),
      makeTask({
        id: "d2",
        title: "Fenster putzen",
        status: "done",
        completedAt: new Date("2026-09-28T09:00:00Z"),
        completedBy: "nevio",
      }),
      makeTask({
        id: "d3",
        title: "Uralt",
        status: "done",
        completedAt: new Date("2026-08-30T07:00:00Z"),
        completedBy: "nevio",
      }),
    ];
    renderTasks("/tasks?assignee=anna");
    await page();
    const toggle = screen.getByRole("button", { name: "Erledigt (2)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("checkbox", { name: "Bad putzen wieder öffnen" }),
    ).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const reopen = screen.getAllByRole("checkbox", { name: / wieder öffnen$/ });
    expect(reopen.map((box) => box.getAttribute("aria-label"))).toEqual([
      "Bad putzen wieder öffnen",
      "Fenster putzen wieder öffnen",
    ]);
    expect(reopen[0].closest("li")).toHaveTextContent("Anna · Gestern");
    expect(reopen[1].closest("li")).toHaveTextContent("Nevio · Mo., 28. Sept.");
    await userEvent.click(reopen[0]);
    expect(taskServiceMock.reopenTask.mock.calls[0][1]).toMatchObject({ id: "d1" });
  });
});

describe("task sheet (phones)", () => {
  it("creates a task from the empty state with all fields", async () => {
    fakeStore.tasks = [];
    renderTasks();
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Aufgabe hinzufügen" }));
    const sheet = screen.getByRole("dialog", { name: "Neue Aufgabe" });
    const submit = within(sheet).getByRole("button", { name: "Aufgabe hinzufügen" });
    expect(submit).toBeDisabled();
    expect(within(sheet).getByRole("radio", { name: "Niedrig" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(within(sheet).queryByRole("radio", { name: "Keine" })).not.toBeInTheDocument();

    // Enter with an empty title shows the field error.
    await userEvent.type(within(sheet).getByRole("textbox", { name: "Titel" }), "  {Enter}");
    expect(within(sheet).getByText("Gib der Aufgabe einen Namen.")).toBeInTheDocument();

    await userEvent.type(within(sheet).getByRole("textbox", { name: "Titel" }), "Altpapier");
    await userEvent.type(within(sheet).getByRole("textbox", { name: "Notizen" }), " Bündeln ");
    await userEvent.click(within(sheet).getByRole("button", { name: "Anna" }));
    await userEvent.click(within(sheet).getByRole("button", { name: /^Heute/ }));
    await userEvent.click(within(sheet).getByRole("radio", { name: "Mittel" }));
    await userEvent.click(submit);

    expect(taskServiceMock.createTask).toHaveBeenCalledWith(
      "h1",
      {
        title: "Altpapier",
        notes: "Bündeln",
        assigneeId: "anna",
        dueDate: TODAY,
        priority: "medium",
      },
      "nevio",
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Neue Aufgabe" })).not.toBeInTheDocument(),
    );
    expect(rowTitles()).toEqual(["Altpapier"]);
  });

  it("uses 32 px avatars in the «Zuständig» pills", async () => {
    renderTasks();
    await page();
    await userEvent.click(screen.getByRole("button", { name: /^Vermieter anrufen/ }));
    const sheet = screen.getByRole("dialog", { name: "Aufgabe bearbeiten" });
    const anna = within(sheet).getByRole("button", { name: "Anna" });
    expect(anna.querySelector(".size-8")).not.toBeNull();
    expect(within(sheet).getByRole("button", { name: "Niemand" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("edits only the changed fields", async () => {
    renderTasks();
    await page();
    await userEvent.click(screen.getByRole("button", { name: /^Bettwäsche wechseln/ }));
    const sheet = screen.getByRole("dialog", { name: "Aufgabe bearbeiten" });
    const title = within(sheet).getByRole("textbox", { name: "Titel" });
    expect(title).toHaveValue("Bettwäsche wechseln");
    expect(within(sheet).getByRole("radio", { name: "Mittel" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await userEvent.clear(title);
    await userEvent.type(title, "Bettwäsche");
    await userEvent.click(within(sheet).getByRole("button", { name: "Niemand" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Speichern" }));
    expect(taskServiceMock.updateTask).toHaveBeenCalledTimes(1);
    const [, task, changes] = taskServiceMock.updateTask.mock.calls[0];
    expect(task).toMatchObject({ id: "sheets" });
    expect(changes).toEqual({ title: "Bettwäsche", assigneeId: null });
  });

  it("deletes after the confirmation (D22)", async () => {
    renderTasks();
    await page();
    await userEvent.click(screen.getByRole("button", { name: /^Vermieter anrufen/ }));
    await userEvent.click(screen.getByRole("button", { name: "Aufgabe löschen" }));
    const confirm = screen.getByRole("alertdialog", { name: "«Vermieter anrufen» löschen?" });
    expect(confirm).toHaveTextContent("Die Aufgabe verschwindet für Nevio und Anna.");
    await userEvent.click(within(confirm).getByRole("button", { name: "Löschen" }));
    expect(taskServiceMock.deleteTask.mock.calls[0][1]).toMatchObject({ id: "landlord" });
    expect(rowTitles()).not.toContain("Vermieter anrufen");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText("Diese Aufgabe wurde gelöscht.")).not.toBeInTheDocument();
  });

  it("closes when someone else deletes or completes the task (D20, D25)", async () => {
    renderTasks();
    await page();
    await userEvent.click(screen.getByRole("button", { name: /^Vermieter anrufen/ }));
    expect(screen.getByRole("dialog", { name: "Aufgabe bearbeiten" })).toBeInTheDocument();
    act(() => fakeStore.setTasks(fakeStore.tasks.filter((t) => t.id !== "landlord")));
    expect(await screen.findByText("Diese Aufgabe wurde gelöscht.")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Aufgabe bearbeiten" })).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /^Küche putzen/ }));
    act(() =>
      fakeStore.setTasks(
        fakeStore.tasks.map((t) =>
          t.id === "kitchen" ? { ...t, status: "done", completedAt: new Date() } : t,
        ),
      ),
    );
    expect(await screen.findByText("Diese Aufgabe wurde erledigt.")).toBeInTheDocument();
  });
});

describe("desktop (detail panel)", () => {
  beforeEach(() => mockDesktop(true));

  it("shows the summary of all open tasks and selects the first filtered task (D19)", async () => {
    renderTasks("/tasks?assignee=anna");
    await page();
    expect(screen.getByText("5 offen · 1 überfällig · 2 heute fällig")).toBeInTheDocument();
    const panel = screen.getByRole("complementary", { name: "Aufgabendetails" });
    expect(within(panel).getByRole("heading", { name: "Küche putzen" })).toBeInTheDocument();
    expect(panel).toHaveTextContent("Hoch");
    expect(panel).toHaveTextContent("Wiederholt sich nicht");
    expect(within(panel).queryByText("Diesmal überspringen")).not.toBeInTheDocument();
  });

  it("shows the open-task count in the sidebar (B10)", async () => {
    renderTasks();
    await page();
    expect(screen.getByRole("link", { name: "Aufgaben 5" })).toBeInTheDocument();
    act(() => fakeStore.setTasks(fakeStore.tasks.slice(1)));
    expect(screen.getByRole("link", { name: "Aufgaben 4" })).toBeInTheDocument();
  });

  it("selects a row on click, edits via the pencil and deletes via the panel", async () => {
    renderTasks();
    await page();
    const panel = () => screen.getByRole("complementary", { name: "Aufgabendetails" });
    expect(within(panel()).getByRole("heading", { name: "Pflanzen giessen" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Bettwäsche wechseln/ }));
    expect(
      within(panel()).getByRole("heading", { name: "Bettwäsche wechseln" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Bettwäsche wechseln/ })).toHaveAttribute(
      "aria-current",
      "true",
    );

    await userEvent.click(within(panel()).getByRole("button", { name: "Aufgabe bearbeiten" }));
    const dialog = screen.getByRole("dialog", { name: "Aufgabe bearbeiten" });
    expect(
      within(dialog).getByRole("button", { name: "Anna" }).querySelector(".size-7\\.5"),
    ).not.toBeNull();
    expect(within(dialog).getByRole("button", { name: "Aufgabe löschen" })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Abbrechen" }));

    await userEvent.click(within(panel()).getByRole("button", { name: "Löschen" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Löschen" }),
    );
    expect(taskServiceMock.deleteTask.mock.calls[0][1]).toMatchObject({ id: "sheets" });
    expect(within(panel()).getByRole("heading", { name: "Pflanzen giessen" })).toBeInTheDocument();
  });

  it("selects a task created with «Neue Aufgabe»", async () => {
    renderTasks();
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Neue Aufgabe" }));
    const dialog = screen.getByRole("dialog", { name: "Neue Aufgabe" });
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Titel" }), "Fenster putzen");
    await userEvent.click(within(dialog).getByRole("button", { name: "Aufgabe hinzufügen" }));
    const panel = screen.getByRole("complementary", { name: "Aufgabendetails" });
    expect(within(panel).getByRole("heading", { name: "Fenster putzen" })).toBeInTheDocument();
  });
});

describe("Schnellerfassung «Aufgabe» (B13)", () => {
  async function openQuickAdd() {
    renderTasks();
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Schnellerfassung" }));
    return screen.getByRole("dialog", { name: "Schnellerfassung" });
  }

  it("adds tasks in a row with chips", async () => {
    const sheet = await openQuickAdd();
    const input = within(sheet).getByRole("textbox", { name: "Was ist zu tun?" });
    const add = within(sheet).getByRole("button", { name: "Aufgabe hinzufügen" });
    expect(add).toBeDisabled();
    // «Wiederholen» is an action chip (Phase 4 D31), never pressed.
    expect(within(sheet).getByRole("button", { name: "Wiederholen" })).not.toHaveAttribute(
      "aria-pressed",
    );

    await userEvent.type(input, "Altpapier");
    await userEvent.click(within(sheet).getByRole("button", { name: "Heute", pressed: false }));
    await userEvent.click(within(sheet).getByRole("button", { name: /Nevio/ }));
    await userEvent.click(within(sheet).getByRole("button", { name: /Anna/ }));
    // Single choice (D24): Anna replaces Nevio.
    expect(within(sheet).getByRole("button", { name: /Nevio/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await userEvent.click(within(sheet).getByRole("button", { name: "Hoch" }));
    await userEvent.click(add);

    expect(taskServiceMock.createTask).toHaveBeenCalledWith(
      "h1",
      { title: "Altpapier", assigneeId: "anna", dueDate: TODAY, priority: "high" },
      "nevio",
    );
    expect(within(sheet).getByRole("status")).toHaveTextContent(
      "«Altpapier» zu den Aufgaben hinzugefügt",
    );
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(within(sheet).getByRole("button", { name: /Anna/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await userEvent.type(input, "Glas wegbringen{Enter}");
    expect(taskServiceMock.createTask).toHaveBeenLastCalledWith(
      "h1",
      { title: "Glas wegbringen", assigneeId: null, dueDate: null, priority: "low" },
      "nevio",
    );
  });

  it("«Mehr Optionen» opens «Neue Aufgabe» with the values", async () => {
    const sheet = await openQuickAdd();
    await userEvent.type(within(sheet).getByRole("textbox", { name: "Was ist zu tun?" }), "Bad");
    await userEvent.click(within(sheet).getByRole("button", { name: /Anna/ }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Hoch" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Mehr Optionen" }));
    const full = screen.getByRole("dialog", { name: "Neue Aufgabe" });
    expect(within(full).getByRole("textbox", { name: "Titel" })).toHaveValue("Bad");
    expect(within(full).getByRole("button", { name: "Anna" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(full).getByRole("radio", { name: "Hoch" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});

describe("recurring tasks (Phase 4)", () => {
  beforeEach(() => {
    fakeStore.tasks = [
      ...exampleTasks().filter((task) => task.id !== "water"),
      bathroom(),
      makeTask({
        id: "water",
        title: "Pflanzen giessen",
        dueDate: "2026-09-29",
        assigneeId: "nevio",
        recurrence: { freq: "daily", interval: 4 },
        seriesId: "water",
        seriesIndex: 1,
      }),
    ];
  });

  it("rows show the short rule and the rotation (B10)", async () => {
    renderTasks();
    await page();
    const row = screen.getByRole("checkbox", { name: "Abhaken: Bad putzen" }).closest("li")!;
    expect(row).toHaveTextContent("Wöchentlich");
    expect(row).toHaveTextContent("Abwechselnd: Nevio → Anna");
    const water = screen
      .getByRole("checkbox", { name: "Abhaken: Pflanzen giessen" })
      .closest("li")!;
    expect(water).toHaveTextContent("Alle 4 Tage");
    expect(water).not.toHaveTextContent("Abwechselnd");
    const plain = screen.getByRole("checkbox", { name: "Abhaken: Küche putzen" }).closest("li")!;
    expect(plain).not.toHaveTextContent("Wiederholen");
  });

  it("completing passes the recurrence context and names the next assignee (D29)", async () => {
    renderTasks();
    await page();
    await userEvent.click(screen.getByRole("checkbox", { name: "Abhaken: Bad putzen" }));
    await waitFor(() => expect(taskServiceMock.completeTask).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
    expect(taskServiceMock.completeTask.mock.calls[0][3]).toEqual({
      today: TODAY,
      weekStartsOn: 1,
      memberIds: ["nevio", "anna"],
    });
    expect(
      screen.getByText("«Bad putzen» erledigt · als Nächstes ist Anna dran"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Rückgängig" }));
    const [, reopened, list] = taskServiceMock.reopenTask.mock.calls[0];
    expect(reopened).toMatchObject({ id: "bath" });
    expect(list?.map((task) => task.id)).toContain("bath");
  });

  it("without rotation the toast names the next due date (D29)", async () => {
    renderTasks();
    await page();
    await userEvent.click(screen.getByRole("checkbox", { name: "Abhaken: Pflanzen giessen" }));
    expect(
      await screen.findByText(
        "«Pflanzen giessen» erledigt · nächstes Mal am Sa., 3. Okt.",
        undefined,
        {
          timeout: 2000,
        },
      ),
    ).toBeInTheDocument();
  });

  it("reopening from «Erledigt» passes the task list (RTK-10)", async () => {
    fakeStore.tasks = [
      ...fakeStore.tasks,
      bathroom({ id: "bath-old", status: "done", completedAt: new Date(), completedBy: "anna" }),
    ];
    renderTasks();
    await page();
    await userEvent.click(screen.getByRole("button", { name: /Erledigt/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Bad putzen wieder öffnen" }));
    const [, task, list] = taskServiceMock.reopenTask.mock.calls[0];
    expect(task).toMatchObject({ id: "bath-old" });
    expect(list).toHaveLength(fakeStore.tasks.length);
  });

  it("delete asks «Nur diese / Ganze Serie» (RTK-08, B8)", async () => {
    renderTasks();
    await page();
    await userEvent.click(screen.getByRole("button", { name: /^Bad putzen/ }));
    await userEvent.click(screen.getByRole("button", { name: "Aufgabe löschen" }));
    const confirm = screen.getByRole("alertdialog", { name: "«Bad putzen» löschen?" });
    expect(confirm).toHaveTextContent(
      "Diese Aufgabe wiederholt sich jeden Samstag. Was möchtest du löschen?",
    );
    const one = within(confirm).getByRole("radio", { name: /^Nur diese/ });
    const all = within(confirm).getByRole("radio", { name: /^Ganze Serie/ });
    expect(one).toBeChecked();
    expect(confirm).toHaveTextContent("Nur Sa., 3. Okt. Die nächste bleibt.");
    expect(confirm).toHaveTextContent("Alle künftigen Samstage.");

    await userEvent.click(within(confirm).getByRole("button", { name: "Nur diese löschen" }));
    expect(taskServiceMock.deleteOccurrence.mock.calls[0][1]).toMatchObject({ id: "bath" });
    expect(taskServiceMock.deleteOccurrence.mock.calls[0][3]).toMatchObject({ today: TODAY });
    expect(taskServiceMock.deleteTask).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /^Bad putzen/ }));
    await userEvent.click(screen.getByRole("button", { name: "Aufgabe löschen" }));
    const again = screen.getByRole("alertdialog", { name: "«Bad putzen» löschen?" });
    await userEvent.click(within(again).getByRole("radio", { name: /^Ganze Serie/ }));
    expect(within(again).getByRole("radio", { name: /^Ganze Serie/ })).toBeChecked();
    await userEvent.click(within(again).getByRole("button", { name: "Ganze Serie löschen" }));
    expect(taskServiceMock.deleteSeries.mock.calls[0][1]).toMatchObject({ id: "bath" });
    expect(all).not.toBeInTheDocument();
  });

  it("a non-weekly series uses the generic hint", async () => {
    renderTasks();
    await page();
    await userEvent.click(screen.getByRole("button", { name: /^Pflanzen giessen/ }));
    await userEvent.click(screen.getByRole("button", { name: "Aufgabe löschen" }));
    const confirm = screen.getByRole("alertdialog", { name: "«Pflanzen giessen» löschen?" });
    expect(confirm).toHaveTextContent("Diese Aufgabe wiederholt sich alle 4 Tage.");
    expect(confirm).toHaveTextContent("Alle künftigen Wiederholungen.");
  });

  describe("desktop", () => {
    beforeEach(() => mockDesktop(true));

    it("the detail panel shows the rule, the rotation and the preview (D28)", async () => {
      renderTasks();
      await page();
      await userEvent.click(screen.getByRole("button", { name: /^Bad putzen/ }));
      const panel = screen.getByRole("complementary", { name: "Aufgabendetails" });
      expect(panel).toHaveTextContent("Jeden Samstag");
      expect(panel).not.toHaveTextContent("Wiederholt sich nicht");
      expect(within(panel).getByText("Abwechseln")).toBeInTheDocument();
      expect(
        within(panel)
          .getAllByRole("listitem")
          .map((item) => item.textContent),
      ).toEqual(["NENevio", "ANAnna"]);
      expect(panel).toHaveTextContent("Diesen Samstag Nevio, danach Anna am Sa., 10. Okt.");
      expect(within(panel).queryByText("Diesmal überspringen")).not.toBeInTheDocument();
    });

    it("rows show rule and rotation before the date", async () => {
      renderTasks();
      await page();
      const row = screen.getByRole("checkbox", { name: "Abhaken: Bad putzen" }).closest("li")!;
      expect(row).toHaveTextContent(/Wöchentlich.*Nevio → Anna.*Sa\., 3\. Okt\./);
    });

    it("the panel deletes a recurring task through the series dialog", async () => {
      renderTasks();
      await page();
      await userEvent.click(screen.getByRole("button", { name: /^Bad putzen/ }));
      const panel = screen.getByRole("complementary", { name: "Aufgabendetails" });
      await userEvent.click(within(panel).getByRole("button", { name: "Löschen" }));
      const confirm = screen.getByRole("alertdialog", { name: "«Bad putzen» löschen?" });
      await userEvent.click(within(confirm).getByRole("button", { name: "Nur diese löschen" }));
      expect(taskServiceMock.deleteOccurrence).toHaveBeenCalledTimes(1);
    });
  });
});

describe("editing recurrence and rotation (Phase 4 slice C)", () => {
  async function openQuickAdd() {
    renderTasks();
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Schnellerfassung" }));
    return screen.getByRole("dialog", { name: "Schnellerfassung" });
  }

  it("Schnellerfassung «Wiederholen» → a new weekly task rotating Anna → Nevio (D26, D31, B4)", async () => {
    const quick = await openQuickAdd();
    await userEvent.type(
      within(quick).getByRole("textbox", { name: "Was ist zu tun?" }),
      "Bad putzen",
    );
    await userEvent.click(within(quick).getByRole("button", { name: "Wiederholen" }));

    const sheet = screen.getByRole("dialog", { name: "Neue Aufgabe" });
    expect(within(sheet).getByRole("textbox", { name: "Titel" })).toHaveValue("Bad putzen");
    const repeat = within(sheet).getByRole("group", { name: "Wiederholen" });
    expect(within(repeat).getByRole("button", { name: "Nie" })).toHaveFocus();
    expect(
      within(repeat).queryByRole("button", { name: "Benutzerdefiniert" }),
    ).not.toBeInTheDocument();
    expect(within(sheet).queryByText("Endet")).not.toBeInTheDocument();

    await userEvent.click(within(repeat).getByRole("button", { name: "Wöchentlich" }));
    // D26: no date yet → the first matching date (today is a Wednesday).
    expect(sheet).toHaveTextContent("Jeden Mittwoch");
    expect(within(sheet).getByRole("button", { name: "Ohne Datum" })).toBeDisabled();
    const days = within(sheet).getByRole("group", { name: "An diesen Tagen" });
    expect(
      within(days)
        .getAllByRole("button")
        .map((day) => day.textContent),
    ).toEqual(["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]);
    // D33: the only selected day stays selected.
    await userEvent.click(within(days).getByRole("button", { name: "Mittwoch" }));
    expect(within(days).getByRole("button", { name: "Mittwoch" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.click(within(sheet).getByRole("switch", { name: "Abwechseln" }));
    const rotation = within(sheet).getByRole("list", { name: "Abwechseln" });
    expect(within(rotation).getAllByRole("listitem")[0]).toHaveTextContent("Diesmal");
    expect(sheet).toHaveTextContent("Abwechseln ist an: diesmal Nevio, danach Anna.");
    expect(within(sheet).getByRole("button", { name: "Nevio" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(within(rotation).getByRole("button", { name: "Anna nach oben" }));
    expect(within(sheet).getByRole("button", { name: "Anna" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(sheet).toHaveTextContent("Bad putzen · jeden Mittwoch · Anna → Nevio");

    await userEvent.click(within(sheet).getByRole("button", { name: "Aufgabe hinzufügen" }));
    expect(taskServiceMock.createTask.mock.calls[0][1]).toEqual({
      title: "Bad putzen",
      assigneeId: "anna",
      dueDate: TODAY,
      priority: "low",
      recurrence: { freq: "weekly", interval: 1, byWeekday: [3] },
      rotation: { memberIds: ["anna", "nevio"], index: 0 },
    });
  });

  it("«Alle N Tage» with the stepper (2–52)", async () => {
    const quick = await openQuickAdd();
    await userEvent.type(
      within(quick).getByRole("textbox", { name: "Was ist zu tun?" }),
      "Pflanzen",
    );
    await userEvent.click(within(quick).getByRole("button", { name: "Wiederholen" }));
    const sheet = screen.getByRole("dialog", { name: "Neue Aufgabe" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Alle N Tage" }));
    expect(within(sheet).getByRole("button", { name: "Weniger" })).toBeDisabled();
    await userEvent.click(within(sheet).getByRole("button", { name: "Mehr" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Mehr" }));
    expect(sheet).toHaveTextContent("Alle 4 Tage");
    expect(within(sheet).queryByRole("switch", { name: "Abwechseln" })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("button", { name: "Aufgabe hinzufügen" }));
    expect(taskServiceMock.createTask.mock.calls[0][1]).toMatchObject({
      recurrence: { freq: "daily", interval: 4 },
      dueDate: TODAY,
    });
    expect(taskServiceMock.createTask.mock.calls[0][1]).not.toHaveProperty("rotation");
  });

  describe("an existing series", () => {
    beforeEach(() => {
      fakeStore.tasks = [...exampleTasks(), bathroom()];
    });

    async function openBathroom() {
      renderTasks();
      await page();
      await userEvent.click(screen.getByRole("button", { name: /^Bad putzen/ }));
      return screen.getByRole("dialog", { name: "Aufgabe bearbeiten" });
    }

    it("shows the rule and rotation; a title edit writes only the title (B4)", async () => {
      const sheet = await openBathroom();
      expect(within(sheet).getByRole("button", { name: "Wöchentlich" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(within(sheet).getByRole("button", { name: "Samstag" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(within(sheet).getByRole("switch", { name: "Abwechseln" })).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect(
        within(sheet).queryByRole("button", { name: "Datum entfernen" }),
      ).not.toBeInTheDocument();
      const title = within(sheet).getByRole("textbox", { name: "Titel" });
      await userEvent.clear(title);
      await userEvent.type(title, "Bad gründlich putzen");
      await userEvent.click(within(sheet).getByRole("button", { name: "Speichern" }));
      expect(taskServiceMock.updateTask.mock.calls[0][2]).toEqual({
        title: "Bad gründlich putzen",
      });
    });

    it("«Nie» ends the repeat (B6)", async () => {
      const sheet = await openBathroom();
      await userEvent.click(within(sheet).getByRole("button", { name: "Nie" }));
      expect(within(sheet).queryByRole("switch", { name: "Abwechseln" })).not.toBeInTheDocument();
      await userEvent.click(within(sheet).getByRole("button", { name: "Speichern" }));
      expect(taskServiceMock.updateTask.mock.calls[0][2]).toEqual({
        recurrence: null,
        rotation: null,
      });
    });

    it("«Niemand» turns the rotation off; changing the rule keeps the rotation", async () => {
      const sheet = await openBathroom();
      await userEvent.click(within(sheet).getByRole("button", { name: "Alle N Wochen" }));
      await userEvent.click(within(sheet).getByRole("button", { name: "Sonntag" }));
      await userEvent.click(within(sheet).getByRole("button", { name: "Speichern" }));
      expect(taskServiceMock.updateTask.mock.calls[0][2]).toEqual({
        recurrence: { freq: "weekly", interval: 2, byWeekday: [0, 6] },
      });

      await userEvent.click(screen.getByRole("button", { name: /^Bad putzen/ }));
      const again = screen.getByRole("dialog", { name: "Aufgabe bearbeiten" });
      await userEvent.click(within(again).getByRole("button", { name: "Niemand" }));
      expect(within(again).getByRole("switch", { name: "Abwechseln" })).toHaveAttribute(
        "aria-checked",
        "false",
      );
      await userEvent.click(within(again).getByRole("button", { name: "Speichern" }));
      expect(taskServiceMock.updateTask.mock.calls[1][2]).toEqual({
        assigneeId: null,
        rotation: null,
      });
    });

    it("desktop: the two-column dialog with rotation chips", async () => {
      mockDesktop(true);
      renderTasks();
      await page();
      await userEvent.click(screen.getByRole("button", { name: /^Bad putzen/ }));
      const panel = screen.getByRole("complementary", { name: "Aufgabendetails" });
      await userEvent.click(within(panel).getByRole("button", { name: "Aufgabe bearbeiten" }));
      const dialog = screen.getByRole("dialog", { name: "Aufgabe bearbeiten" });
      expect(dialog.querySelector("form")).toHaveClass("grid-cols-2");
      const rotation = within(dialog).getByRole("list", { name: "Abwechseln" });
      expect(within(rotation).getByRole("button", { name: "Nevio nach vorne" })).toBeDisabled();
      await userEvent.click(within(rotation).getByRole("button", { name: "Anna nach vorne" }));
      expect(dialog).toHaveTextContent("Abwechseln ist an: diesmal Anna, danach Nevio.");
      await userEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));
      expect(taskServiceMock.updateTask.mock.calls[0][2]).toEqual({
        assigneeId: "anna",
        rotation: { memberIds: ["anna", "nevio"], index: 0 },
      });
    });
  });
});

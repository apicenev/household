import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeStore, makeItem, makeMember, makeTask } from "../../tests/householdFakes";
import { HouseholdProvider } from "./HouseholdProvider";
import { useHousehold } from "./useHousehold";

vi.mock("../firebase", () => ({ auth: {}, db: {} }));
vi.mock("../../services/householdService", () =>
  import("../../tests/householdFakes").then((fakes) => fakes.householdServiceMock),
);
vi.mock("../../services/memberService", () =>
  import("../../tests/householdFakes").then((fakes) => fakes.memberServiceMock),
);
vi.mock("../../services/taskService", () =>
  import("../../tests/householdFakes").then((fakes) => fakes.taskServiceMock),
);
vi.mock("../../services/shoppingService", () =>
  import("../../tests/householdFakes").then((fakes) => fakes.shoppingServiceMock),
);

function TasksProbe() {
  const { tasks, tasksLoading, tasksError, retryTasks } = useHousehold();
  return (
    <>
      <output data-testid="tasks">
        {JSON.stringify({
          tasks: tasks.map((task) => task.id),
          tasksLoading,
          tasksError: tasksError?.message ?? null,
          pending: tasks.filter((task) => task.hasPendingWrites).map((task) => task.id),
        })}
      </output>
      <button type="button" onClick={retryTasks}>
        retryTasks
      </button>
    </>
  );
}

function ItemsProbe() {
  const { items, itemsLoading, itemsError, retryItems, itemStats } = useHousehold();
  return (
    <>
      <output data-testid="items">
        {JSON.stringify({
          items: items.map((item) => item.id),
          itemsLoading,
          itemsError: itemsError?.message ?? null,
          stats: itemStats.map((stat) => stat.key),
        })}
      </output>
      <button type="button" onClick={retryItems}>
        retryItems
      </button>
    </>
  );
}

const items = () => JSON.parse(screen.getByTestId("items").textContent ?? "{}");

function Probe() {
  const { household, members, me, isOwner, memberById, loading, error } = useHousehold();
  return (
    <output data-testid="state">
      {JSON.stringify({
        name: household?.name ?? null,
        members: members.map((member) => member.uid),
        me: me?.uid ?? null,
        isOwner,
        anna: memberById("anna")?.displayName ?? null,
        loading,
        error: error?.message ?? null,
      })}
    </output>
  );
}

const state = () => JSON.parse(screen.getByTestId("state").textContent ?? "{}");

function renderProvider(uid: string) {
  return render(
    <HouseholdProvider householdId="h1" uid={uid}>
      <Probe />
      <TasksProbe />
      <ItemsProbe />
    </HouseholdProvider>,
  );
}

beforeEach(() => {
  fakeStore.reset();
});

describe("HouseholdProvider", () => {
  it("exposes the household, members sorted owner first, me and isOwner", () => {
    renderProvider("nevio");
    expect(state()).toEqual({
      name: "Musterstrasse 12",
      members: ["nevio", "anna"],
      me: "nevio",
      isOwner: true,
      anna: "Anna",
      loading: false,
      error: null,
    });
  });

  it("knows a member isn't the owner", () => {
    renderProvider("anna");
    expect(state()).toMatchObject({ me: "anna", isOwner: false });
  });

  it("is loading until household and members have both arrived", () => {
    fakeStore.hold = true;
    renderProvider("nevio");
    expect(state()).toMatchObject({ loading: true, name: null });
    act(() => {
      for (const listener of fakeStore.householdListeners) listener.onChange(fakeStore.household);
    });
    expect(state().loading).toBe(true);
    act(() => fakeStore.emit());
    expect(state().loading).toBe(false);
  });

  it("updates live when a member joins", () => {
    renderProvider("nevio");
    fakeStore.members = [
      ...fakeStore.members,
      makeMember({ uid: "lea", displayName: "Lea", joinedAt: new Date("2026-10-01") }),
    ];
    act(() => fakeStore.emit());
    expect(state().members).toEqual(["nevio", "anna", "lea"]);
  });

  it("reports listener errors", () => {
    fakeStore.error = new Error("permission-denied");
    renderProvider("nevio");
    expect(state()).toMatchObject({ loading: false, error: "permission-denied", name: null });
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderProvider("nevio");
    expect(fakeStore.householdListeners.size).toBe(1);
    expect(fakeStore.memberListeners.size).toBe(1);
    unmount();
    expect(fakeStore.householdListeners.size).toBe(0);
    expect(fakeStore.memberListeners.size).toBe(0);
    expect(fakeStore.unsubscribed).toEqual(["h1"]);
  });

  it("exposes the tasks with their own loading state, without blocking the shell", () => {
    fakeStore.holdTasks = true;
    renderProvider("nevio");
    expect(screen.getByTestId("tasks").textContent).toBe(
      JSON.stringify({ tasks: [], tasksLoading: true, tasksError: null, pending: [] }),
    );
    expect(state().loading).toBe(false);
    fakeStore.tasks = [makeTask({ id: "t1" }), makeTask({ id: "t2", hasPendingWrites: true })];
    act(() => fakeStore.emitTasks());
    expect(JSON.parse(screen.getByTestId("tasks").textContent ?? "")).toEqual({
      tasks: ["t1", "t2"],
      tasksLoading: false,
      tasksError: null,
      pending: ["t2"],
    });
  });

  it("reports a task listener error separately and retries it", () => {
    fakeStore.tasksError = new Error("boom");
    renderProvider("nevio");
    expect(state()).toMatchObject({ loading: false, error: null, name: "Musterstrasse 12" });
    expect(JSON.parse(screen.getByTestId("tasks").textContent ?? "")).toMatchObject({
      tasksLoading: false,
      tasksError: "boom",
    });
    fakeStore.tasksError = null;
    fakeStore.tasks = [makeTask({ id: "t1" })];
    act(() => screen.getByRole("button", { name: "retryTasks" }).click());
    expect(JSON.parse(screen.getByTestId("tasks").textContent ?? "")).toMatchObject({
      tasks: ["t1"],
      tasksError: null,
    });
    expect(fakeStore.taskListeners.size).toBe(1);
  });

  it("unsubscribes the task listener on unmount", () => {
    const { unmount } = renderProvider("nevio");
    expect(fakeStore.taskListeners.size).toBe(1);
    unmount();
    expect(fakeStore.taskListeners.size).toBe(0);
  });

  it("exposes the shopping list with its own loading state, without blocking the shell", () => {
    fakeStore.holdItems = true;
    renderProvider("nevio");
    expect(items()).toEqual({ items: [], itemsLoading: true, itemsError: null, stats: [] });
    expect(state().loading).toBe(false);
    fakeStore.items = [makeItem({ id: "milk" })];
    fakeStore.itemStats = [
      { key: "milch", name: "Milch", category: "groceries", count: 3, lastPurchasedAt: new Date() },
    ];
    act(() => fakeStore.emitItems());
    expect(items()).toEqual({
      items: ["milk"],
      itemsLoading: false,
      itemsError: null,
      stats: ["milch"],
    });
  });

  it("reports a shopping listener error separately and retries it", () => {
    fakeStore.itemsError = new Error("boom");
    renderProvider("nevio");
    expect(state()).toMatchObject({ loading: false, error: null });
    expect(items()).toMatchObject({ itemsLoading: false, itemsError: "boom" });
    fakeStore.itemsError = null;
    fakeStore.items = [makeItem({ id: "milk" })];
    act(() => screen.getByRole("button", { name: "retryItems" }).click());
    expect(items()).toMatchObject({ items: ["milk"], itemsError: null });
    expect(fakeStore.itemListeners.size).toBe(1);
    expect(fakeStore.statListeners.size).toBe(1);
  });

  it("unsubscribes the shopping listeners on unmount", () => {
    const { unmount } = renderProvider("nevio");
    expect(fakeStore.itemListeners.size).toBe(1);
    expect(fakeStore.statListeners.size).toBe(1);
    unmount();
    expect(fakeStore.itemListeners.size).toBe(0);
    expect(fakeStore.statListeners.size).toBe(0);
  });
});

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeStore, makeMember } from "../../tests/householdFakes";
import { HouseholdProvider } from "./HouseholdProvider";
import { useHousehold } from "./useHousehold";

vi.mock("../firebase", () => ({ auth: {}, db: {} }));
vi.mock("../../services/householdService", () =>
  import("../../tests/householdFakes").then((fakes) => fakes.householdServiceMock),
);
vi.mock("../../services/memberService", () =>
  import("../../tests/householdFakes").then((fakes) => fakes.memberServiceMock),
);

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
});

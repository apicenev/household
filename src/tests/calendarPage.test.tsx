import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/ToastProvider";
import { allDayToStored, zonedToInstant } from "../domain/eventTime";
import { AuthContext, type AuthContextValue } from "../lib/auth/useAuth";
import { AppRoutes } from "../router/AppRoutes";
import type { CalendarEvent } from "../types";
import {
  eventServiceMock,
  fakeStore,
  makeEvent,
  makeHousehold,
  nevioProfile,
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

// Mi., 30. Sept. 2026, 14:10 in Zurich.
const NOW = new Date("2026-09-30T12:10:00Z");
const ZURICH = "Europe/Zurich";

function renderCalendar(entry = "/calendar") {
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
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

const currentUrl = () => screen.getByTestId("location").textContent ?? "";
// The lazy page can take more than findBy's default 1 s to load under full-suite load.
const page = () => screen.findByRole("heading", { name: "Kalender", level: 1 }, { timeout: 3000 });
const grid = () => screen.getByRole("grid");
const cell = (label: RegExp | string) => within(grid()).getByRole("gridcell", { name: label });

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

function timed(
  id: string,
  title: string,
  day: string,
  from: string,
  to: string,
  overrides: Partial<CalendarEvent> = {},
  toDay = day,
) {
  return makeEvent({
    id,
    title,
    start: zonedToInstant(day, from, ZURICH),
    end: zonedToInstant(toDay, to, ZURICH),
    ...overrides,
  });
}

function allDay(
  id: string,
  title: string,
  first: string,
  last: string,
  overrides: Partial<CalendarEvent> = {},
) {
  return makeEvent({ id, title, allDay: true, ...allDayToStored(first, last), ...overrides });
}

/** The prototype's events around 30 Sept 2026. */
function exampleEvents(): CalendarEvent[] {
  return [
    allDay("laundry", "Waschtag", "2026-09-30", "2026-09-30", { category: "home" }),
    timed(
      "games",
      "Spieleabend",
      "2026-09-30",
      "22:00",
      "01:00",
      { category: "social" },
      "2026-10-01",
    ),
    timed("dinner", "Znacht mit Freunden", "2026-10-02", "19:30", "22:30", {
      category: "social",
      description: "Bei Lena und Jonas.",
    }),
    timed("doctor", "Arzttermin", "2026-10-06", "08:15", "09:00", {
      category: "appointment",
      participants: ["anna"],
    }),
    allDay("trip", "Ferien", "2026-10-14", "2026-10-21", { category: "travel" }),
  ];
}

beforeAll(async () => {
  await import("../pages/CalendarPage");
});

/** The service writes land in the fake store at once, as Firestore's latency compensation. */
function optimisticWrites() {
  let seq = 0;
  eventServiceMock.createEvent.mockImplementation((_hid, input, actorId) => {
    seq += 1;
    const id = `new${seq}`;
    fakeStore.setEvents([...fakeStore.events, makeEvent({ ...input, id, createdBy: actorId })]);
    return { id, committed: Promise.resolve() };
  });
  eventServiceMock.updateEvent.mockImplementation(async (_hid, id, changes) =>
    fakeStore.setEvents(
      fakeStore.events.map((e) =>
        e.id === id
          ? {
              ...e,
              ...changes,
              description:
                changes.description === undefined
                  ? e.description
                  : (changes.description ?? undefined),
              recurrence:
                changes.recurrence === undefined ? e.recurrence : (changes.recurrence ?? undefined),
            }
          : e,
      ),
    ),
  );
  eventServiceMock.deleteEvent.mockImplementation(async (_hid, id) =>
    fakeStore.setEvents(fakeStore.events.filter((e) => e.id !== id)),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  fakeStore.reset();
  fakeStore.events = exampleEvents();
  eventServiceMock.createEvent.mockReset();
  eventServiceMock.updateEvent.mockReset();
  eventServiceMock.deleteEvent.mockReset();
  optimisticWrites();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.title = "";
});

describe("Kalender: month view (CAL-01, B7, B8)", () => {
  it("opens on the current month with today selected", async () => {
    renderCalendar();
    await page();
    await waitFor(() => expect(document.title).toBe("Kalender – Household"));
    expect(screen.getByRole("heading", { name: "September 2026", level: 2 })).toBeInTheDocument();
    expect(grid()).toHaveAccessibleName("September 2026");
    expect(cell("Mi., 30. Sept., heute, 2 Termine")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Heute · Mi., 30. Sept." })).toBeInTheDocument();
  });

  it("navigates months via the URL, ‹ › and «Heute»", async () => {
    renderCalendar("/calendar?month=2026-11");
    await page();
    expect(screen.getByRole("heading", { name: "November 2026", level: 2 })).toBeInTheDocument();
    // Not the current month: the 1st is selected.
    expect(screen.getByRole("heading", { name: "So., 1. Nov." })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Vorheriger Monat" }));
    expect(screen.getByRole("heading", { name: "Oktober 2026", level: 2 })).toBeInTheDocument();
    expect(currentUrl()).toBe("/calendar?month=2026-10");

    await userEvent.click(screen.getByRole("button", { name: "Nächster Monat" }));
    await userEvent.click(screen.getByRole("button", { name: "Nächster Monat" }));
    expect(currentUrl()).toBe("/calendar?month=2026-12");

    await userEvent.click(screen.getByRole("button", { name: "Heute" }));
    expect(screen.getByRole("heading", { name: "September 2026", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Heute · Mi., 30. Sept." })).toBeInTheDocument();
    expect(currentUrl()).toBe("/calendar");
  });

  it("falls back to the current month for an invalid ?month=", async () => {
    renderCalendar("/calendar?month=foo");
    await page();
    expect(screen.getByRole("heading", { name: "September 2026", level: 2 })).toBeInTheDocument();
  });

  it("follows the household's week start", async () => {
    renderCalendar();
    await page();
    const headers = () =>
      within(grid())
        .getAllByRole("columnheader")
        .map((h) => h.textContent);
    expect(headers()).toEqual(["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]);
    act(() => {
      fakeStore.household = makeHousehold({ weekStartsOn: 0 });
      fakeStore.emit();
    });
    await waitFor(() => expect(headers()[0]).toBe("So"));
  });

  it("labels cells with their events and selects a day of another month", async () => {
    renderCalendar("/calendar?month=2026-10");
    await page();
    expect(cell("Mi., 14. Okt., 1 Termin")).toBeInTheDocument();
    expect(cell("Do., 15. Okt., 1 Termin")).toBeInTheDocument();
    expect(cell("Mi., 7. Okt., keine Termine")).toBeInTheDocument();
    // The greyed 30 Sept is selectable and switches the month.
    await userEvent.click(cell(/^Mi\., 30\. Sept\., heute/));
    expect(screen.getByRole("heading", { name: "September 2026", level: 2 })).toBeInTheDocument();
    expect(currentUrl()).toBe("/calendar?month=2026-09&day=2026-09-30");
  });

  it("moves focus with the keyboard and selects with Enter (D57)", async () => {
    renderCalendar("/calendar?month=2026-10&day=2026-10-30");
    await page();
    const selected = cell(/^Fr\., 30\. Okt\./);
    expect(selected).toHaveAttribute("tabindex", "0");
    selected.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toHaveAccessibleName("Sa., 31. Okt., keine Termine");
    await userEvent.keyboard("{ArrowDown}");
    // 7 Nov is in November: the month switches, focus stays on that day.
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "November 2026", level: 2 })).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(document.activeElement).toHaveAccessibleName("Sa., 7. Nov., keine Termine"),
    );
    await userEvent.keyboard("{Enter}");
    expect(currentUrl()).toBe("/calendar?month=2026-11&day=2026-11-07");
    await userEvent.keyboard("{PageUp}");
    await waitFor(() => expect(document.activeElement).toHaveAccessibleName(/^Mi\., 7\. Okt\./));
  });
});

describe("Kalender: selected day (CAL-02, B4, D54, D55)", () => {
  it("lists today's events, all-day first, with the midnight labels", async () => {
    renderCalendar();
    await page();
    const panel = screen.getByRole("heading", { name: "Heute · Mi., 30. Sept." }).parentElement!
      .parentElement!;
    expect(within(panel).getByText("2 Termine")).toBeInTheDocument();
    const cards = within(panel).getAllByRole("button");
    expect(cards.map((card) => card.textContent)).toEqual([
      expect.stringMatching(/^Ganztägig.*Waschtag.*Zuhause/),
      expect.stringMatching(/^22:00bis Do\..*Spieleabend.*Freizeit/),
    ]);
  });

  it("shows «bis 01:00» on the next day, «Tag 3 von 8» on a trip day, avatars and «Nichts geplant»", async () => {
    renderCalendar("/calendar?day=2026-10-01");
    await page();
    expect(screen.getByRole("heading", { name: "Morgen · Do., 1. Okt." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bis 01:00.*Spieleabend/ })).toBeInTheDocument();

    await userEvent.click(cell(/^Fr\., 16\. Okt\./));
    expect(screen.getByText("Tag 3 von 8")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Für: Alle" })).toBeInTheDocument();

    await userEvent.click(cell(/^Di\., 6\. Okt\./));
    expect(screen.getByRole("img", { name: "Für: Anna" })).toBeInTheDocument();

    await userEvent.click(cell(/^Mi\., 7\. Okt\./));
    expect(screen.getByText("Nichts geplant")).toBeInTheDocument();
  });
});

describe("Kalender: «Demnächst» (CAL-03, B9)", () => {
  it("groups by day, lists «Ferien» once and today's all-day event under «Heute»", async () => {
    renderCalendar();
    await page();
    await userEvent.click(screen.getByRole("tab", { name: "Demnächst" }));
    expect(screen.getByRole("tab", { name: "Demnächst" })).toHaveAttribute("aria-selected", "true");
    expect(currentUrl()).toBe("/calendar?view=upcoming");
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Heute30. Sept.", "Fr.2. Okt.", "Di.6. Okt.", "Mi.14. Okt."]);
    expect(screen.getAllByRole("button", { name: /Ferien/ })).toHaveLength(1);
    expect(screen.getByText("· 14.–21. Okt. · 8 Tage")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Waschtag/ })).toBeInTheDocument();
  });

  it("lists the last day of a running trip under «Heute»", async () => {
    fakeStore.events = [
      allDay("trip", "Ferien", "2026-09-23", "2026-09-30", { category: "travel" }),
    ];
    renderCalendar("/calendar?view=upcoming");
    await page();
    expect(screen.getByRole("heading", { name: "Heute30. Sept." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ferien/ })).toBeInTheDocument();
  });

  it("shows the empty state without events (D51)", async () => {
    fakeStore.events = [];
    renderCalendar("/calendar?view=upcoming");
    await page();
    expect(screen.getByText("Nichts geplant")).toBeInTheDocument();
    expect(screen.getByText("In den nächsten 60 Tagen steht nichts an.")).toBeInTheDocument();
  });
});

describe("Kalender: Termin-Detail on phones (D45, D52)", () => {
  it("opens from a card with a history entry and goes back", async () => {
    renderCalendar("/calendar?day=2026-10-02");
    await page();
    await userEvent.click(screen.getByRole("button", { name: /Znacht mit Freunden/ }));
    expect(
      await screen.findByRole("heading", { name: "Znacht mit Freunden", level: 1 }),
    ).toBeInTheDocument();
    expect(currentUrl()).toBe("/calendar?day=2026-10-02&event=dinner");
    expect(screen.getByText("Fr., 2. Okt. · 19:30–22:30")).toBeInTheDocument();
    expect(screen.getByText("Bei Lena und Jonas.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Für: Alle" })).toBeInTheDocument();
    // No tab bar (its centre + is «Schnellerfassung») while the detail is open.
    expect(screen.queryByRole("button", { name: "Schnellerfassung" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Kalender" }));
    expect(await screen.findByRole("heading", { name: "Fr., 2. Okt." })).toBeInTheDocument();
    expect(currentUrl()).toBe("/calendar?day=2026-10-02");
    expect(screen.getByRole("button", { name: "Schnellerfassung" })).toBeInTheDocument();
  });

  it("opens from a «Demnächst» row and shows a trip's range", async () => {
    renderCalendar("/calendar?view=upcoming");
    await page();
    await userEvent.click(screen.getByRole("button", { name: /Ferien/ }));
    expect(await screen.findByRole("heading", { name: "Ferien", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Mi., 14. – Mi., 21. Okt. · 8 Tage")).toBeInTheDocument();
  });

  it("closes with a toast when the event is deleted elsewhere", async () => {
    renderCalendar("/calendar?event=dinner");
    expect(
      await screen.findByRole(
        "heading",
        { name: "Znacht mit Freunden", level: 1 },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    act(() => fakeStore.setEvents(fakeStore.events.filter((e) => e.id !== "dinner")));
    expect(await screen.findByText("Dieser Termin wurde gelöscht.")).toBeInTheDocument();
    await waitFor(() => expect(currentUrl()).toBe("/calendar"));
    expect(screen.getByRole("heading", { name: "Kalender", level: 1 })).toBeInTheDocument();
  });

  it("drops an unknown ?event= silently", async () => {
    renderCalendar("/calendar?event=missing");
    await page();
    await waitFor(() => expect(currentUrl()).toBe("/calendar"));
    expect(screen.queryByText("Dieser Termin wurde gelöscht.")).not.toBeInTheDocument();
  });
});

describe("Kalender: desktop", () => {
  beforeEach(() => mockDesktop(true));

  it("draws the trip bar with its title at the start and at the week start", async () => {
    renderCalendar("/calendar?month=2026-10");
    await page();
    expect(cell(/^Mi\., 14\. Okt\./)).toHaveTextContent("Ferien");
    expect(cell(/^Do\., 15\. Okt\./)).not.toHaveTextContent("Ferien");
    expect(cell(/^Mo\., 19\. Okt\./)).toHaveTextContent("Ferien");
    expect(cell(/^Fr\., 2\. Okt\./)).toHaveTextContent("19:30Znacht mit Freunden");
  });

  it("expands a card of the selected day with its rule line", async () => {
    renderCalendar("/calendar?day=2026-10-02");
    await page();
    const panel = screen.getByRole("complementary", { name: "Ausgewählter Tag" });
    const toggle = within(panel).getByRole("button", { name: /Znacht mit Freunden/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(panel).getByText("Wiederholt sich nicht · 19:30–22:30")).toBeInTheDocument();
    expect(currentUrl()).toBe("/calendar?day=2026-10-02&event=dinner");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("turns ?event= into the event's day with its card open (B8)", async () => {
    renderCalendar("/calendar?event=trip");
    await page();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Mi., 14. Okt." })).toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: "Oktober 2026", level: 2 })).toBeInTheDocument();
    const panel = screen.getByRole("complementary", { name: "Ausgewählter Tag" });
    expect(within(panel).getByRole("button", { name: /Ferien/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(within(panel).getByText("Mi., 14. – Mi., 21. Okt. · 8 Tage · Alle")).toBeInTheDocument();
  });

  it("a «Demnächst» row selects its day and expands the card", async () => {
    renderCalendar("/calendar?view=upcoming");
    await page();
    await userEvent.click(screen.getByRole("button", { name: /^08:15–09:00.*Arzttermin/ }));
    const panel = screen.getByRole("complementary", { name: "Ausgewählter Tag" });
    expect(within(panel).getByRole("heading", { name: "Di., 6. Okt." })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /Arzttermin/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});

describe("Kalender: loading and errors (D49, D50)", () => {
  it("shows skeletons until the events arrive", async () => {
    fakeStore.holdEvents = true;
    renderCalendar();
    await page();
    expect(grid()).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("status", { name: "Lädt" }).length).toBeGreaterThan(0);
    act(() => fakeStore.emitEvents());
    await waitFor(() => expect(grid()).not.toHaveAttribute("aria-busy"));
    expect(screen.getByText("2 Termine")).toBeInTheDocument();
  });

  it("shows the error with a retry", async () => {
    fakeStore.eventsError = new Error("boom");
    renderCalendar();
    await page();
    expect(screen.getByText("Kalender konnte nicht geladen werden.")).toBeInTheDocument();
    fakeStore.eventsError = null;
    await userEvent.click(screen.getByRole("button", { name: "Nochmals versuchen" }));
    await waitFor(() =>
      expect(screen.queryByText("Kalender konnte nicht geladen werden.")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("2 Termine")).toBeInTheDocument();
  });
});

const sheet = (name: string) => screen.getByRole("dialog", { name });
const pill = (container: HTMLElement, label: string) =>
  within(container).getByLabelText(label) as HTMLInputElement;

describe("Termin-Sheet: create (CAL-04, CAL-05, D47, D48, B6)", () => {
  beforeEach(() => mockDesktop(true));

  it("creates a timed event for Anna with the right instants", async () => {
    renderCalendar("/calendar?day=2026-10-02");
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Neuer Termin" }));
    const dialog = sheet("Neuer Termin");
    // Defaults for another day: 09:00–10:00, «Alle», «Sonstiges».
    expect(pill(dialog, "Beginn, Datum")).toHaveValue("2026-10-02");
    expect(pill(dialog, "Beginn, Uhrzeit")).toHaveValue("09:00");
    expect(pill(dialog, "Ende, Uhrzeit")).toHaveValue("10:00");
    expect(within(dialog).getByRole("button", { name: "Alle" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(dialog).getByRole("radio", { name: "Sonstiges" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await userEvent.type(within(dialog).getByRole("textbox", { name: "Titel" }), "Kino");
    // A start past the end (10:00) takes the end along (B6): 19:30 → 20:30.
    fireEvent.change(pill(dialog, "Beginn, Uhrzeit"), { target: { value: "19:30" } });
    expect(pill(dialog, "Ende, Uhrzeit")).toHaveValue("20:30");
    fireEvent.change(pill(dialog, "Ende, Uhrzeit"), { target: { value: "22:30" } });
    // A start still before the end leaves the end where it is.
    fireEvent.change(pill(dialog, "Beginn, Uhrzeit"), { target: { value: "18:00" } });
    expect(pill(dialog, "Ende, Uhrzeit")).toHaveValue("22:30");
    fireEvent.change(pill(dialog, "Beginn, Datum"), { target: { value: "2026-09-28" } });
    expect(pill(dialog, "Ende, Datum")).toHaveValue("2026-10-02");
    fireEvent.change(pill(dialog, "Beginn, Datum"), { target: { value: "2026-10-02" } });
    fireEvent.change(pill(dialog, "Beginn, Uhrzeit"), { target: { value: "19:30" } });
    expect(pill(dialog, "Ende, Uhrzeit")).toHaveValue("22:30");
    await userEvent.click(within(dialog).getByRole("button", { name: /Anna/ }));
    await userEvent.click(within(dialog).getByRole("radio", { name: "Freizeit" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Termin hinzufügen" }));

    expect(eventServiceMock.createEvent).toHaveBeenCalledTimes(1);
    const [hid, input, actor] = eventServiceMock.createEvent.mock.calls[0];
    expect([hid, actor]).toEqual(["h1", "nevio"]);
    expect(input).toEqual({
      title: "Kino",
      category: "social",
      allDay: false,
      start: new Date("2026-10-02T17:30:00Z"),
      end: new Date("2026-10-02T20:30:00Z"),
      participants: ["anna"],
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Kino/ })).toBeInTheDocument();
  });

  it("shows the end-before-start error and disables saving (D48)", async () => {
    renderCalendar("/calendar?day=2026-10-02");
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Neuer Termin" }));
    const dialog = sheet("Neuer Termin");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Titel" }), "Kino");
    fireEvent.change(pill(dialog, "Ende, Uhrzeit"), { target: { value: "08:00" } });
    expect(
      within(dialog).getByText("Das Ende darf nicht vor dem Beginn liegen."),
    ).toBeInTheDocument();
    expect(pill(dialog, "Ende, Uhrzeit")).toHaveAttribute("aria-invalid", "true");
    expect(within(dialog).getByRole("button", { name: "Termin hinzufügen" })).toBeDisabled();
  });

  it("asks for a title on Enter", async () => {
    renderCalendar();
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Neuer Termin" }));
    const dialog = sheet("Neuer Termin");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Titel" }), "{Enter}");
    expect(within(dialog).getByText("Gib einen Titel ein.")).toBeInTheDocument();
    expect(eventServiceMock.createEvent).not.toHaveBeenCalled();
  });

  it("creates a multi-day all-day event with 00:00 UTC dates (B2)", async () => {
    renderCalendar("/calendar?day=2026-10-14");
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Neuer Termin" }));
    const dialog = sheet("Neuer Termin");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Titel" }), "Velotour");
    await userEvent.click(within(dialog).getByRole("switch", { name: "Ganztägig" }));
    expect(within(dialog).queryByLabelText("Beginn, Uhrzeit")).not.toBeInTheDocument();
    fireEvent.change(pill(dialog, "Ende, Datum"), { target: { value: "2026-10-16" } });
    await userEvent.click(within(dialog).getByRole("button", { name: "Termin hinzufügen" }));
    expect(eventServiceMock.createEvent.mock.calls[0][1]).toMatchObject({
      allDay: true,
      start: new Date("2026-10-14T00:00:00Z"),
      end: new Date("2026-10-16T00:00:00Z"),
      participants: "household",
    });
  });

  it("«Für»: «Alle» → Anna → Anna and Nevio = «Alle»; the last one stays (D58)", async () => {
    renderCalendar();
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Neuer Termin" }));
    const dialog = sheet("Neuer Termin");
    const chip = (name: RegExp | string) => within(dialog).getByRole("button", { name });
    await userEvent.click(chip(/Anna/));
    expect(chip(/Anna/)).toHaveAttribute("aria-pressed", "true");
    expect(chip("Alle")).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(chip(/Anna/));
    expect(chip(/Anna/)).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(chip(/Nevio/));
    expect(chip("Alle")).toHaveAttribute("aria-pressed", "true");
    expect(chip(/Anna/)).toHaveAttribute("aria-pressed", "false");
  });

  it("«Termin hinzufügen» on an empty day opens «Neuer Termin» on that day", async () => {
    renderCalendar("/calendar?day=2026-10-07");
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Termin hinzufügen" }));
    expect(pill(sheet("Neuer Termin"), "Beginn, Datum")).toHaveValue("2026-10-07");
  });
});

describe("Termin-Sheet: edit and delete (CAL-06, B5, D52, D53)", () => {
  beforeEach(() => mockDesktop(true));

  async function openDinner() {
    renderCalendar("/calendar?day=2026-10-02&event=dinner");
    await page();
    const panel = screen.getByRole("complementary", { name: "Ausgewählter Tag" });
    await waitFor(() =>
      expect(within(panel).getByRole("button", { name: /Znacht mit Freunden/ })).toHaveAttribute(
        "aria-expanded",
        "true",
      ),
    );
    return panel;
  }

  it("edits category and clears the description; only changed fields are sent", async () => {
    const panel = await openDinner();
    await userEvent.click(within(panel).getByRole("button", { name: "Bearbeiten" }));
    const dialog = sheet("Termin bearbeiten");
    expect(within(dialog).getByRole("textbox", { name: "Titel" })).toHaveValue(
      "Znacht mit Freunden",
    );
    expect(within(dialog).getByRole("button", { name: "Speichern" })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("radio", { name: "Zuhause" }));
    await userEvent.clear(within(dialog).getByRole("textbox", { name: "Beschreibung" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));
    expect(eventServiceMock.updateEvent).toHaveBeenCalledWith("h1", "dinner", {
      category: "home",
      description: null,
    });
  });

  it("drops a former member on save (B5)", async () => {
    fakeStore.events = exampleEvents().map((e) =>
      e.id === "doctor" ? { ...e, participants: ["anna", "gone"] } : e,
    );
    renderCalendar("/calendar?day=2026-10-06&event=doctor");
    await page();
    const panel = screen.getByRole("complementary", { name: "Ausgewählter Tag" });
    await userEvent.click(await within(panel).findByRole("button", { name: "Bearbeiten" }));
    const dialog = sheet("Termin bearbeiten");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Titel" }), " Dr. Keller");
    await userEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));
    expect(eventServiceMock.updateEvent).toHaveBeenCalledWith("h1", "doctor", {
      title: "Arzttermin Dr. Keller",
      participants: ["anna"],
    });
  });

  it("deletes after the confirmation, without a «deleted elsewhere» toast", async () => {
    const panel = await openDinner();
    await userEvent.click(within(panel).getByRole("button", { name: "Löschen" }));
    const confirm = screen.getByRole("alertdialog", { name: "«Znacht mit Freunden» löschen?" });
    expect(
      within(confirm).getByText("Der Termin verschwindet für Nevio und Anna."),
    ).toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole("button", { name: "Löschen" }));
    expect(eventServiceMock.deleteEvent).toHaveBeenCalledWith("h1", "dinner");
    await waitFor(() => expect(currentUrl()).toBe("/calendar?day=2026-10-02"));
    expect(screen.queryByText("Dieser Termin wurde gelöscht.")).not.toBeInTheDocument();
  });

  it("deletes from the desktop dialog's footer", async () => {
    const panel = await openDinner();
    await userEvent.click(within(panel).getByRole("button", { name: "Bearbeiten" }));
    await userEvent.click(
      within(sheet("Termin bearbeiten")).getByRole("button", { name: "Termin löschen" }),
    );
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Löschen" }),
    );
    expect(eventServiceMock.deleteEvent).toHaveBeenCalledWith("h1", "dinner");
    expect(screen.queryByText("Dieser Termin wurde gelöscht.")).not.toBeInTheDocument();
  });

  it("closes the sheet with a toast when the event is deleted elsewhere (D52)", async () => {
    const panel = await openDinner();
    await userEvent.click(within(panel).getByRole("button", { name: "Bearbeiten" }));
    expect(sheet("Termin bearbeiten")).toBeInTheDocument();
    act(() => fakeStore.setEvents(fakeStore.events.filter((e) => e.id !== "dinner")));
    expect(await screen.findAllByText("Dieser Termin wurde gelöscht.")).not.toHaveLength(0);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Termin bearbeiten" })).not.toBeInTheDocument(),
    );
  });
});

describe("Termin-Detail actions on phones (D45, D53)", () => {
  it("edits from the header and deletes from the action bar, then goes back", async () => {
    renderCalendar("/calendar?day=2026-10-02");
    await page();
    await userEvent.click(screen.getByRole("button", { name: /Znacht mit Freunden/ }));
    await screen.findByRole("heading", { name: "Znacht mit Freunden", level: 1 });
    const edits = screen.getAllByRole("button", { name: "Bearbeiten" });
    expect(edits).toHaveLength(2);
    await userEvent.click(edits[0]);
    expect(sheet("Termin bearbeiten")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Schliessen" }));

    await userEvent.click(screen.getByRole("button", { name: "Löschen" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Löschen" }),
    );
    expect(eventServiceMock.deleteEvent).toHaveBeenCalledWith("h1", "dinner");
    await waitFor(() => expect(currentUrl()).toBe("/calendar?day=2026-10-02"));
    expect(screen.queryByText("Dieser Termin wurde gelöscht.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Znacht mit Freunden/ })).not.toBeInTheDocument();
  });
});

describe("Schnellerfassung «Termin» (D56)", () => {
  async function openQuickAdd(entry: string, heading: string) {
    renderCalendar(entry);
    await screen.findByRole("heading", { name: heading, level: 1 }, { timeout: 3000 });
    await userEvent.click(screen.getByRole("button", { name: "Schnellerfassung" }));
    const quick = screen.getByRole("dialog", { name: "Schnellerfassung" });
    await userEvent.click(within(quick).getByRole("radio", { name: "Termin" }));
    return quick;
  }

  it("adds in a row with the status line and keeps the focus", async () => {
    const quick = await openQuickAdd("/tasks", "Aufgaben");
    const field = within(quick).getByRole("textbox", { name: "Was steht an?" });
    // Today on another page: today at the next full hour, «Alle», «Sonstiges».
    expect(within(quick).getByRole("button", { name: "Mi., 30. Sept." })).toBeInTheDocument();
    expect(within(quick).getByRole("button", { name: "15:00" })).toBeInTheDocument();
    expect(within(quick).getByRole("button", { name: "Alle" })).not.toHaveAttribute("aria-pressed");
    await userEvent.type(field, "Znacht{Enter}");
    expect(within(quick).getByRole("status")).toHaveTextContent(
      "«Znacht» zum Kalender hinzugefügt",
    );
    expect(field).toHaveValue("");
    expect(field).toHaveFocus();
    expect(eventServiceMock.createEvent.mock.calls[0][1]).toEqual({
      title: "Znacht",
      category: "other",
      allDay: false,
      start: new Date("2026-09-30T13:00:00Z"),
      end: new Date("2026-09-30T14:00:00Z"),
      participants: "household",
    });
  });

  it("uses the calendar's selected day, and a chip opens «Neuer Termin» there", async () => {
    const quick = await openQuickAdd("/calendar?day=2026-10-14", "Kalender");
    expect(within(quick).getByRole("button", { name: "Mi., 14. Okt." })).toBeInTheDocument();
    expect(within(quick).getByRole("button", { name: "09:00" })).toBeInTheDocument();
    await userEvent.type(within(quick).getByRole("textbox", { name: "Was steht an?" }), "Apéro");
    await userEvent.click(within(quick).getByRole("button", { name: "Sonstiges" }));
    const dialog = await screen.findByRole("dialog", { name: "Neuer Termin" });
    expect(within(dialog).getByRole("textbox", { name: "Titel" })).toHaveValue("Apéro");
    expect(pill(dialog, "Beginn, Datum")).toHaveValue("2026-10-14");
    expect(screen.queryByRole("dialog", { name: "Schnellerfassung" })).not.toBeInTheDocument();
  });
});

describe("Kalender: recurring events (Phase 7 slice B)", () => {
  // «Grossputz» every 2 weeks on Saturday since Sa., 19. Sept.: 3, 17 (during «Ferien») and
  // 31 Oct (after the DST change), 14 Nov …; «Miete bezahlen» monthly on the 1st; a course
  // that ended on Di., 15. Sept.
  beforeEach(() => {
    fakeStore.events = [
      ...exampleEvents(),
      timed("cleaning", "Grossputz", "2026-09-19", "10:00", "12:00", {
        category: "home",
        description: "Küche, Bad, Böden und Fenster.",
        recurrence: { freq: "weekly", interval: 2, byWeekday: [6] },
      }),
      allDay("rent", "Miete bezahlen", "2026-09-01", "2026-09-01", {
        category: "reminder",
        recurrence: { freq: "monthly", interval: 1, byMonthDay: 1 },
      }),
      timed("swim", "Schwimmkurs", "2026-08-04", "17:00", "18:00", {
        category: "appointment",
        recurrence: { freq: "weekly", interval: 1, byWeekday: [2], until: "2026-09-15" },
      }),
    ];
  });

  it("shows every occurrence in the month grid (acceptance criterion 3 / 17 / 31 Oct)", async () => {
    renderCalendar("/calendar?month=2026-10");
    await page();
    expect(cell("Sa., 3. Okt., 1 Termin")).toBeInTheDocument();
    expect(cell("Sa., 10. Okt., keine Termine")).toBeInTheDocument();
    expect(cell("Sa., 17. Okt., 2 Termine")).toBeInTheDocument();
    expect(cell("Sa., 31. Okt., 1 Termin")).toBeInTheDocument();
    expect(cell("Do., 1. Okt., 2 Termine")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Nächster Monat" }));
    expect(cell("Sa., 14. Nov., 1 Termin")).toBeInTheDocument();
    expect(cell("Sa., 28. Nov., 1 Termin")).toBeInTheDocument();
    expect(cell("So., 1. Nov., 1 Termin")).toBeInTheDocument();
    expect(cell("Di., 3. Nov., keine Termine")).toBeInTheDocument();
  });

  it("marks series cards and «Demnächst» rows with the rule (B8)", async () => {
    renderCalendar("/calendar?day=2026-10-31");
    await page();
    const card = screen.getByRole("button", { name: /Grossputz/ });
    expect(card).toHaveTextContent("10:0012:00");
    expect(card).toHaveTextContent("Alle 2 Wochen");

    await userEvent.click(screen.getByRole("tab", { name: "Demnächst" }));
    const rows = screen.getAllByRole("button", { name: /Grossputz/ });
    expect(rows).toHaveLength(5); // 3, 17, 31 Oct, 14, 28 Nov (within 60 days)
    expect(rows[0]).toHaveTextContent("Alle 2 Wochen");
    const rent = screen.getAllByRole("button", { name: /Miete bezahlen/ });
    expect(rent).toHaveLength(2); // 1 Oct, 1 Nov
    expect(rent[0]).toHaveTextContent("Monatlich");
    expect(screen.queryByRole("button", { name: /Schwimmkurs/ })).not.toBeInTheDocument();
  });

  it("opens an occurrence's detail with the rule block and «Nächste Termine» (D63–D65)", async () => {
    renderCalendar("/calendar?day=2026-10-03");
    await page();
    await userEvent.click(screen.getByRole("button", { name: /Grossputz/ }));
    expect(await screen.findByRole("heading", { name: "Grossputz", level: 1 })).toBeInTheDocument();
    expect(currentUrl()).toBe("/calendar?day=2026-10-03&event=cleaning%402026-10-03");
    expect(screen.getByText("Sa., 3. Okt. · 10:00–12:00")).toBeInTheDocument();
    expect(screen.getByText("Alle 2 Wochen · Samstag · 10:00–12:00 · Alle")).toBeInTheDocument();
    expect(screen.getByText("Seit Sa., 19. Sept. · endet nie")).toBeInTheDocument();

    const next = screen.getAllByRole("listitem");
    expect(screen.getByRole("heading", { name: "Nächste Termine" })).toBeInTheDocument();
    expect(next.map((item) => item.textContent)).toEqual([
      "Sa., 17. Okt.Während Ferien10:00–12:00",
      "Sa., 31. Okt.10:00–12:00",
      "Sa., 14. Nov.10:00–12:00",
    ]);
  });

  it("opens later occurrences with their own date, also after the DST change", async () => {
    renderCalendar("/calendar?event=cleaning%402026-10-31");
    expect(
      await screen.findByRole("heading", { name: "Grossputz", level: 1 }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sa., 31. Okt. · 10:00–12:00")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Sa., 14. Nov.");
  });

  it("falls back to the next occurrence for a bare id or a date off the schedule (B9)", async () => {
    renderCalendar("/calendar?event=cleaning%402026-10-10");
    expect(
      await screen.findByRole("heading", { name: "Grossputz", level: 1 }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sa., 3. Okt. · 10:00–12:00")).toBeInTheDocument();
  });

  it("shows an ended series without «Nächste Termine» (D63, D64)", async () => {
    renderCalendar("/calendar?event=swim");
    expect(
      await screen.findByRole("heading", { name: "Schwimmkurs", level: 1 }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Di., 15. Sept. · 17:00–18:00")).toBeInTheDocument();
    expect(screen.getByText("Endete am Di., 15. Sept.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Nächste Termine" })).not.toBeInTheDocument();
  });

  it("an all-day series shows «Ganztägig» in its rule", async () => {
    renderCalendar("/calendar?event=rent");
    expect(
      await screen.findByRole("heading", { name: "Miete bezahlen", level: 1 }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Do., 1. Okt. · Ganztägig")).toBeInTheDocument();
    expect(screen.getByText("Monatlich am 1. · Ganztägig · Alle")).toBeInTheDocument();
    expect(screen.getByText("Seit Di., 1. Sept. · endet nie")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "So., 1. Nov.Ganztägig",
      "Di., 1. Dez.Ganztägig",
      "Fr., 1. Jan.Ganztägig",
    ]);
  });

  it("closes with a toast when the series is deleted elsewhere (D52)", async () => {
    renderCalendar("/calendar?event=cleaning%402026-10-17");
    expect(
      await screen.findByRole("heading", { name: "Grossputz", level: 1 }, { timeout: 3000 }),
    ).toBeInTheDocument();
    act(() => fakeStore.setEvents(fakeStore.events.filter((e) => e.id !== "cleaning")));
    expect(await screen.findByText("Dieser Termin wurde gelöscht.")).toBeInTheDocument();
    await waitFor(() => expect(currentUrl()).toBe("/calendar"));
  });

  describe("desktop", () => {
    beforeEach(() => mockDesktop(true));

    it("turns a bare series id into its next occurrence's day with the card open (B9)", async () => {
      renderCalendar("/calendar?event=cleaning");
      await page();
      await waitFor(() =>
        expect(currentUrl()).toBe(
          "/calendar?event=cleaning%402026-10-03&month=2026-10&day=2026-10-03",
        ),
      );
      const panel = screen.getByRole("complementary", { name: "Ausgewählter Tag" });
      expect(within(panel).getByRole("button", { name: /Grossputz/ })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      expect(
        within(panel).getByText("Alle 2 Wochen · Samstag · 10:00–12:00 · Alle"),
      ).toBeInTheDocument();
    });

    it("expands an occurrence by its key and a «Demnächst» row selects its own day", async () => {
      renderCalendar("/calendar?day=2026-10-17");
      await page();
      const panel = screen.getByRole("complementary", { name: "Ausgewählter Tag" });
      await userEvent.click(within(panel).getByRole("button", { name: /Grossputz/ }));
      expect(currentUrl()).toBe("/calendar?day=2026-10-17&event=cleaning%402026-10-17");

      await userEvent.click(screen.getByRole("tab", { name: "Demnächst" }));
      const rows = screen.getAllByRole("button", { name: /^10:00–12:00.*Grossputz/ });
      await userEvent.click(rows[2]);
      expect(within(panel).getByRole("heading", { name: "Sa., 31. Okt." })).toBeInTheDocument();
      expect(within(panel).getByRole("button", { name: /Grossputz/ })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      expect(currentUrl()).toContain("event=cleaning%402026-10-31");
    });
  });
});

describe("Termin-Sheet: recurring events (Phase 7 slice C)", () => {
  beforeEach(() => mockDesktop(true));

  async function newEventOn(day: string, title: string) {
    renderCalendar(`/calendar?day=${day}`);
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Neuer Termin" }));
    const dialog = sheet("Neuer Termin");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Titel" }), title);
    return dialog;
  }

  const created = () => eventServiceMock.createEvent.mock.calls[0][1];

  it("creates «Grossputz» every 2 weeks on Saturday (REV-01)", async () => {
    const dialog = await newEventOn("2026-10-03", "Grossputz");
    expect(within(dialog).getByText("Wiederholt sich nicht")).toBeInTheDocument();
    expect(within(dialog).queryByRole("radiogroup", { name: "Endet" })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Alle N Wochen" }));
    expect(within(dialog).getByText("Alle 2 Wochen · Samstag")).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Nie" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    // No «Benutzerdefiniert» for events either (B2).
    expect(
      within(dialog).queryByRole("button", { name: "Benutzerdefiniert" }),
    ).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Termin hinzufügen" }));
    expect(created()).toMatchObject({
      title: "Grossputz",
      start: zonedToInstant("2026-10-03", "09:00", ZURICH),
      end: zonedToInstant("2026-10-03", "10:00", ZURICH),
      recurrence: { freq: "weekly", interval: 2, byWeekday: [6] },
    });
  });

  it("offers «Am 3.» / «Am 1. Samstag» and «Nach N Mal» (D60, REV-02)", async () => {
    const dialog = await newEventOn("2026-10-03", "Flohmarkt");
    await userEvent.click(within(dialog).getByRole("button", { name: "Monatlich" }));
    expect(within(dialog).getByRole("radio", { name: "Am 3." })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await userEvent.click(within(dialog).getByRole("radio", { name: "Am 1. Samstag" }));
    await userEvent.click(within(dialog).getByRole("radio", { name: "Nach N Mal" }));
    expect(within(dialog).getByText("10")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Mehr" }));
    expect(within(dialog).getByText("Monatlich am 1. Samstag · 11 Mal")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Termin hinzufügen" }));
    expect(created().recurrence).toEqual({
      freq: "monthly",
      interval: 1,
      byWeekday: [6],
      bySetPos: 1,
      count: 11,
    });
  });

  it("«Am Datum» defaults to three months later and can't end before the start (D59, D66)", async () => {
    const dialog = await newEventOn("2026-10-03", "Chor");
    await userEvent.click(within(dialog).getByRole("button", { name: "Wöchentlich" }));
    await userEvent.click(within(dialog).getByRole("radio", { name: "Am Datum" }));
    const until = within(dialog).getByLabelText("Endet am") as HTMLInputElement;
    expect(until).toHaveValue("2027-01-31");
    expect(within(dialog).getByText("Jeden Samstag · bis 31. Jan. 2027")).toBeInTheDocument();
    fireEvent.change(until, { target: { value: "2026-10-02" } });
    expect(
      within(dialog).getByText("Das Enddatum darf nicht vor dem Beginn liegen."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Termin hinzufügen" })).toBeDisabled();
    fireEvent.change(until, { target: { value: "2026-12-19" } });
    await userEvent.click(within(dialog).getByRole("button", { name: "Termin hinzufügen" }));
    expect(created().recurrence).toEqual({
      freq: "weekly",
      interval: 1,
      byWeekday: [6],
      until: "2026-12-19",
    });
  });

  it("saves an off-schedule start on the first occurrence (B3)", async () => {
    // Thu 1 Oct, then «Sa» instead of «Do» → the series starts on Sat 3 Oct, same times.
    const dialog = await newEventOn("2026-10-01", "Markt");
    await userEvent.click(within(dialog).getByRole("button", { name: "Wöchentlich" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Samstag" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Donnerstag" }));
    expect(within(dialog).getByText("Jeden Samstag")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Termin hinzufügen" }));
    expect(created()).toMatchObject({
      start: zonedToInstant("2026-10-03", "09:00", ZURICH),
      end: zonedToInstant("2026-10-03", "10:00", ZURICH),
      recurrence: { freq: "weekly", interval: 1, byWeekday: [6] },
    });
  });

  describe("editing and deleting a series (REV-04, D61, D62)", () => {
    beforeEach(() => {
      fakeStore.events = [
        ...exampleEvents(),
        timed("cleaning", "Grossputz", "2026-09-19", "10:00", "12:00", {
          category: "home",
          recurrence: { freq: "weekly", interval: 2, byWeekday: [6] },
        }),
      ];
    });

    async function editFromCard(day: string) {
      renderCalendar(`/calendar?day=${day}`);
      await page();
      const panel = screen.getByRole("complementary", { name: "Ausgewählter Tag" });
      await userEvent.click(within(panel).getByRole("button", { name: /Grossputz/ }));
      await userEvent.click(within(panel).getByRole("button", { name: "Bearbeiten" }));
      return sheet("Termin bearbeiten");
    }

    it("opens the series with its first date and the hint, and changes only the end", async () => {
      const dialog = await editFromCard("2026-10-17");
      expect(
        within(dialog).getByText(
          "Änderungen gelten für alle Termine dieser Serie (seit Sa., 19. Sept.).",
        ),
      ).toBeInTheDocument();
      expect(pill(dialog, "Beginn, Datum")).toHaveValue("2026-09-19");
      expect(within(dialog).getByRole("button", { name: "Alle N Wochen" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(within(dialog).getByRole("button", { name: "Speichern" })).toBeDisabled();
      await userEvent.click(within(dialog).getByRole("radio", { name: "Nach N Mal" }));
      await userEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));
      expect(eventServiceMock.updateEvent).toHaveBeenCalledWith("h1", "cleaning", {
        recurrence: { freq: "weekly", interval: 2, byWeekday: [6], count: 10 },
      });
    });

    it("«Nie» turns the series into a one-off event (B10)", async () => {
      const dialog = await editFromCard("2026-10-03");
      await userEvent.click(within(dialog).getByRole("button", { name: "Nie" }));
      await userEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));
      expect(eventServiceMock.updateEvent).toHaveBeenCalledWith("h1", "cleaning", {
        recurrence: null,
      });
      // The open card follows the event to its only date left, Sa., 19. Sept.
      await waitFor(() => expect(currentUrl()).toContain("day=2026-09-19"));
      const panel = screen.getByRole("complementary", { name: "Ausgewählter Tag" });
      expect(within(panel).getByText("Wiederholt sich nicht · 10:00–12:00")).toBeInTheDocument();
    });

    it("one-off events show no series hint", async () => {
      renderCalendar("/calendar?day=2026-10-02");
      await page();
      const panel = screen.getByRole("complementary", { name: "Ausgewählter Tag" });
      await userEvent.click(within(panel).getByRole("button", { name: /Znacht/ }));
      await userEvent.click(within(panel).getByRole("button", { name: "Bearbeiten" }));
      expect(
        within(sheet("Termin bearbeiten")).queryByText(/Änderungen gelten/),
      ).not.toBeInTheDocument();
    });

    it("deletes the whole series after the series confirmation (D62)", async () => {
      renderCalendar("/calendar?day=2026-10-17");
      await page();
      const panel = screen.getByRole("complementary", { name: "Ausgewählter Tag" });
      await userEvent.click(within(panel).getByRole("button", { name: /Grossputz/ }));
      await userEvent.click(within(panel).getByRole("button", { name: "Löschen" }));
      const confirm = screen.getByRole("alertdialog", { name: "«Grossputz» löschen?" });
      expect(
        within(confirm).getByText("Alle Termine dieser Serie verschwinden für Nevio und Anna."),
      ).toBeInTheDocument();
      await userEvent.click(within(confirm).getByRole("button", { name: "Löschen" }));
      expect(eventServiceMock.deleteEvent).toHaveBeenCalledWith("h1", "cleaning");
      expect(screen.queryByText("Dieser Termin wurde gelöscht.")).not.toBeInTheDocument();
    });
  });
});

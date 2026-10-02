import { describe, expect, it } from "vitest";
import { parseTaskFilters, taskFiltersToParams } from "./taskFilters";

const members = ["nevio", "anna"];

describe("parseTaskFilters", () => {
  it("reads all three filters", () => {
    expect(
      parseTaskFilters(new URLSearchParams("assignee=anna&due=week&priority=high"), members),
    ).toEqual({ assignee: "anna", due: "week", priority: "high" });
    expect(parseTaskFilters(new URLSearchParams("assignee=none&due=none"), members)).toEqual({
      assignee: "none",
      due: "none",
    });
  });

  it("ignores unknown values (B3)", () => {
    expect(
      parseTaskFilters(
        new URLSearchParams("assignee=lea&due=month&priority=low&status=done"),
        members,
      ),
    ).toEqual({});
    expect(parseTaskFilters(new URLSearchParams(""), members)).toEqual({});
  });
});

describe("taskFiltersToParams", () => {
  it("writes the filters and round-trips", () => {
    const filters = { assignee: "nevio", due: "overdue", priority: "high" } as const;
    const params = taskFiltersToParams(filters);
    expect(params.toString()).toBe("assignee=nevio&due=overdue&priority=high");
    expect(parseTaskFilters(params, members)).toEqual(filters);
  });

  it("removes cleared filters and keeps other parameters", () => {
    const base = new URLSearchParams("assignee=anna&due=today&foo=1");
    expect(taskFiltersToParams({ due: "today" }, base).toString()).toBe("foo=1&due=today");
    expect(taskFiltersToParams({}, base).toString()).toBe("foo=1");
  });
});

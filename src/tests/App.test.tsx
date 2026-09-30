import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "../App";

vi.mock("../lib/firebase", () => ({
  firebaseProjectId: "household-test",
  usingEmulators: false,
}));

describe("App", () => {
  it("renders the Household brand", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Household" })).toBeInTheDocument();
  });

  it("shows which Firebase project is active", () => {
    render(<App />);
    expect(screen.getByText("Firebase: household-test")).toBeInTheDocument();
  });
});

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserProfile } from "../../types";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./useAuth";

// --- Fake firebase/auth: listeners fire before signIn/signOut resolve, like the real SDK. ---
type FakeUser = { uid: string; email: string; displayName: string | null };
const fakeAuth = vi.hoisted(() => {
  const listeners = new Set<(user: FakeUser | null) => void>();
  let current: FakeUser | null = null;
  return {
    listeners,
    get current() {
      return current;
    },
    emit(user: FakeUser | null) {
      current = user;
      for (const listener of listeners) listener(user);
    },
    reset() {
      listeners.clear();
      current = null;
    },
  };
});

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: FakeUser | null) => void) => {
    fakeAuth.listeners.add(callback);
    // Firebase reports the restored session asynchronously.
    queueMicrotask(() => callback(fakeAuth.current));
    return () => fakeAuth.listeners.delete(callback);
  },
  signInWithEmailAndPassword: async (_auth: unknown, email: string, password: string) => {
    if (password !== "household-dev") {
      throw Object.assign(new Error("bad"), { code: "auth/invalid-credential" });
    }
    fakeAuth.emit({ uid: email.split("@")[0], email, displayName: null });
  },
  signOut: async () => fakeAuth.emit(null),
}));

vi.mock("../firebase", () => ({ auth: {}, db: {} }));

const services = vi.hoisted(() => ({
  ensureUserProfile: vi.fn<() => Promise<void>>(),
  profileUnsubscribe: vi.fn(),
  profileCallback: null as ((profile: UserProfile | null) => void) | null,
}));

vi.mock("../../services/userService", () => ({
  ensureUserProfile: services.ensureUserProfile,
  listenToUserProfile: (_uid: string, onChange: (profile: UserProfile | null) => void) => {
    services.profileCallback = onChange;
    return services.profileUnsubscribe;
  },
}));

function Probe() {
  const { user, profile, initializing, login, logout } = useAuth();
  return (
    <div>
      <output data-testid="state">
        {JSON.stringify({
          uid: user?.uid ?? null,
          initializing,
          name: profile?.displayName,
        })}
      </output>
      <button onClick={() => void login("nevio@example.ch", "household-dev").catch(() => {})}>
        login
      </button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

const state = () => JSON.parse(screen.getByTestId("state").textContent ?? "{}");

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

const nevio = { uid: "nevio", email: "nevio@example.ch" };
const restoredNevio = { ...nevio, displayName: "Nevio" };

beforeEach(() => {
  fakeAuth.reset();
  services.ensureUserProfile.mockReset().mockResolvedValue();
  services.profileUnsubscribe.mockReset();
  services.profileCallback = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AuthProvider", () => {
  it("finishes initializing without a user", async () => {
    renderProvider();
    expect(state().initializing).toBe(true);
    await waitFor(() => expect(state()).toMatchObject({ uid: null, initializing: false }));
    expect(services.ensureUserProfile).not.toHaveBeenCalled();
  });

  it("signs in, ensures the profile and listens to it", async () => {
    renderProvider();
    await waitFor(() => expect(state().initializing).toBe(false));

    await act(async () => screen.getByText("login").click());
    await waitFor(() => expect(state()).toMatchObject({ uid: "nevio", initializing: false }));

    // Console-created accounts have no Auth display name; the service falls back to the email.
    expect(services.ensureUserProfile).toHaveBeenCalledWith(nevio, "");
    act(() =>
      services.profileCallback?.({
        uid: "nevio",
        displayName: "Nevio",
        email: nevio.email,
        initials: "NE",
        avatarColor: 3,
        createdAt: new Date(),
      }),
    );
    expect(state().name).toBe("Nevio");
  });

  it("passes the Auth display name of a restored session to the profile", async () => {
    fakeAuth.emit(restoredNevio);
    renderProvider();
    await waitFor(() => expect(state()).toMatchObject({ uid: "nevio", initializing: false }));
    expect(services.ensureUserProfile).toHaveBeenCalledWith(nevio, "Nevio");
  });

  it("stays signed in when the profile can't be created offline", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    services.ensureUserProfile.mockRejectedValueOnce(
      Object.assign(new Error("offline"), { code: "unavailable" }),
    );
    fakeAuth.emit(restoredNevio);
    renderProvider();
    await waitFor(() => expect(state()).toMatchObject({ uid: "nevio", initializing: false }));
    await act(async () => {});
    expect(error).not.toHaveBeenCalled();
  });

  it("logout stops the profile listener", async () => {
    fakeAuth.emit(restoredNevio);
    renderProvider();
    await waitFor(() => expect(state().uid).toBe("nevio"));

    await act(async () => screen.getByText("logout").click());
    expect(services.profileUnsubscribe).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({ uid: null, initializing: false });
  });

  it("rejects login with the Firebase error and stays signed out", async () => {
    renderProvider();
    await waitFor(() => expect(state().initializing).toBe(false));
    let caught: unknown;
    function Login() {
      const { login } = useAuth();
      return (
        <button onClick={() => login("nevio@example.ch", "falsch").catch((e) => (caught = e))}>
          x
        </button>
      );
    }
    render(
      <AuthProvider>
        <Login />
      </AuthProvider>,
    );
    await act(async () => screen.getByText("x").click());
    expect(caught).toMatchObject({ code: "auth/invalid-credential" });
    expect(state().uid).toBeNull();
  });
});

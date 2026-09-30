import { HomeIcon } from "@heroicons/react/24/outline";
import { firebaseProjectId, usingEmulators } from "./lib/firebase";

export default function App() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="card w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-card bg-brand text-brand-ink">
          <HomeIcon className="size-8" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Household</h1>
        <p className="mt-2 text-ink-muted">
          Tasks, shopping and plans for everyone at home. Coming soon.
        </p>
        <p className="mt-6">
          <span className="badge">
            {usingEmulators ? "Emulators" : `Firebase: ${firebaseProjectId}`}
          </span>
        </p>
      </div>
    </main>
  );
}

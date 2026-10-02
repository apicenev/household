import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  throw new Error(
    `Missing Firebase config: ${missing.join(", ")}. ` +
      "Copy .env.example to .env.local and fill in the VITE_FIREBASE_* values, " +
      "or run `npm run dev:emu` to use the local emulators.",
  );
}

export const usingEmulators = env.VITE_USE_EMULATORS === "true";
export const firebaseProjectId: string = firebaseConfig.projectId;

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// German texts for anything Firebase Auth itself shows or sends.
auth.languageCode = "de";
export const db = getFirestore(app);

if (usingEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8180);
}

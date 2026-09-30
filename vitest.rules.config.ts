import { defineConfig } from "vitest/config";

// Security rules tests run in Node against the Firestore emulator.
// Use `npm run test:rules`, which starts and stops the emulator around the run.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/tests/rules/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});

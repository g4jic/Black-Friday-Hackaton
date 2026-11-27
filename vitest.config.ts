import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Offline: Mozaik Cloud off and every fetch to another host blocked (see the file).
    setupFiles: ["tests/setup.ts"],
    environment: "node",
    testTimeout: 15000,
  },
})

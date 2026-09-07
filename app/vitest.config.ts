import { describe, expect, test } from "vitest";
import { resolve } from "path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@capacitor/core": resolve(__dirname, "src/__tests__/capacitor-core-stub.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/__tests__/**/*.test.ts"],
  },
});

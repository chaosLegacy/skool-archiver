import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": "/src"
    }
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "https://www.skool.com/" }
    },
    include: ["src/**/*.test.ts"]
  }
});

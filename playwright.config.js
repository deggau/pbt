import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/ui",
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3106",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/ui-server.js",
    url: "http://127.0.0.1:3106/health",
    reuseExistingServer: false,
  },
  reporter: "list",
});

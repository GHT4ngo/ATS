import { execSync } from "node:child_process";
import { defineConfig } from "@playwright/test";

// E2E always runs against the local Supabase stack, never the cloud project
// that .env.local points at.
function localSupabase() {
  const out = execSync("pnpm exec supabase status -o json", {
    encoding: "utf8",
  });
  const status = JSON.parse(out.slice(out.indexOf("{")));
  return {
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL as string,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY as string,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY as string,
    // A fixed secret for the retention job, so the tests can call it.
    CRON_SECRET: "e2e-cron-secret",
  };
}

const env = localSupabase();
Object.assign(process.env, env);

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  // The dev server compiles each route on its first request, which can take
  // longer than the default 5 seconds on a CI runner.
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "pnpm dev --port 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    // AI_FAKE returns a fixed assessment instead of calling Claude.
    env: { ...env, AI_FAKE: "1" },
  },
});

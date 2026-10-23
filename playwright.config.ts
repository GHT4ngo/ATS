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
  };
}

const env = localSupabase();
Object.assign(process.env, env);

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "pnpm dev --port 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    env,
  },
});

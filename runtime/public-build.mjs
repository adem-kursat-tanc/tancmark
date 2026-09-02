import { spawnSync } from "node:child_process";

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) {
  process.stderr.write("PUBLIC_BUILD_FAILED: npm_execpath is unavailable; run with pnpm run build.\n");
  process.exit(2);
}

const result = spawnSync(
  process.execPath,
  [pnpmCli, "-r", "--if-present", "run", "build"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: process.env.PORT ?? "4173",
      BASE_PATH: process.env.BASE_PATH ?? "/",
    },
    stdio: "inherit",
  },
);

if (result.error) {
  process.stderr.write(`PUBLIC_BUILD_FAILED: ${result.error.message}\n`);
  process.exit(2);
}

process.exit(result.status ?? 2);

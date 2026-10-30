// Starts the standalone build (output: "standalone"). Next does not copy public/ and
// .next/static/ into the standalone folder, so this script does it before booting server.js.
// Used by `npm start` locally, by Playwright, and as the Hostinger start command.
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");
const server = join(standalone, "server.js");

if (!existsSync(server)) {
  console.error("Missing .next/standalone/server.js. Run `npm run build` first.");
  process.exit(1);
}

// server.js binds to $HOSTNAME, which shells and hosts often set to the machine name
// (making the app unreachable on localhost). Bind explicitly; override with BIND_HOST.
process.env.HOSTNAME = process.env.BIND_HOST ?? "0.0.0.0";

// public/ may not exist in a fresh checkout (Git does not track empty folders).
if (existsSync(join(root, "public"))) {
  cpSync(join(root, "public"), join(standalone, "public"), { recursive: true });
}
cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), { recursive: true });

await import(pathToFileURL(server).href);

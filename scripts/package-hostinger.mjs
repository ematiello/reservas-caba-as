// Packages the local standalone build for Hostinger (dist/hostinger/app.tgz).
// The Hostinger build host has an old glibc, so Next's native SWC cannot load there:
// build locally with `npm run build`, then upload this archive with the Hostinger MCP
// (`hosting_deployJsApplication`). Hostinger only runs `npm install` (next/react/react-dom)
// and the `build` check below, then publishes .next/standalone and starts server.js.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");
const out = join(root, "dist", "hostinger");
const stage = join(out, "stage");
const archive = join(out, "app.tgz");

if (!existsSync(join(standalone, "server.js"))) {
  console.error("Missing .next/standalone/server.js. Run `npm run build` first.");
  process.exit(1);
}

const { dependencies } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const pinned = Object.fromEntries(
  ["next", "react", "react-dom"].map((name) => [name, dependencies[name]]),
);

rmSync(out, { recursive: true, force: true });
mkdirSync(join(stage, ".next"), { recursive: true });

// Windows-only native binaries (sharp) are useless on Linux; images are unoptimized anyway.
const stagedStandalone = join(stage, ".next", "standalone");
cpSync(standalone, stagedStandalone, {
  recursive: true,
  filter: (src) => !/[\\/]@img[\\/]sharp-(win32|darwin)/.test(src),
});

// Next does not copy public/ and .next/static/ into the standalone folder.
if (existsSync(join(root, "public"))) {
  cpSync(join(root, "public"), join(stagedStandalone, "public"), { recursive: true });
}
cpSync(join(root, ".next", "static"), join(stagedStandalone, ".next", "static"), { recursive: true });
cpSync(join(root, ".next", "static"), join(stage, ".next", "static"), { recursive: true });
cpSync(join(root, ".next", "BUILD_ID"), join(stage, ".next", "BUILD_ID"));

// Declaring `next` makes Hostinger detect a Next.js app (without it, it picks "other" and
// never starts a process). The build script only verifies the prebuilt output exists.
writeFileSync(
  join(stage, "package.json"),
  JSON.stringify(
    {
      name: "reservas-saas-prebuilt",
      version: "0.1.0",
      private: true,
      scripts: {
        build: `node -e "require('fs').accessSync('.next/standalone/server.js')"`,
        start: "node .next/standalone/server.js",
      },
      dependencies: pinned,
      engines: { node: ">=22" },
    },
    null,
    2,
  ) + "\n",
);

// Relative paths on purpose: GNU tar reads a Windows drive letter ("C:\...") as a remote host.
const tar = spawnSync("tar", ["-czf", "app.tgz", "-C", "stage", "."], { cwd: out, stdio: "inherit" });
if (tar.status !== 0) {
  console.error("tar failed; it must be available on PATH.");
  process.exit(1);
}

rmSync(stage, { recursive: true, force: true });
console.log(`${archive} (${(statSync(archive).size / 1024 / 1024).toFixed(1)} MB)`);

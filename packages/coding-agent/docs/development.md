# Development

See [AGENTS.md](https://github.com/earendil-works/pi/blob/main/AGENTS.md) for additional guidelines.

## Setup

```bash
git clone https://github.com/earendil-works/pi
cd pi
npm install
npm run build
```

Run from source:

```bash
/path/to/pi/pi-test.sh
```

The script can be run from any directory. Pi keeps the caller's current working directory.

### Experimental remote harness

The remote harness server/client integration is development-only. Run it from the repository with:

```bash
PI_EXPERIMENTAL=1 ./pi-test.sh server
PI_EXPERIMENTAL=1 ./pi-test.sh client
```

`PI_SERVER_DIR` overrides the server profile and socket directory (default: `~/.pi/server`). `PI_SERVER_ID` selects the logical server ID when `--server-id` is omitted.

The `client` and `experimental/plugin` package subpaths resolve only under the `source` condition in a checkout. Their implementations and the server/client commands are excluded from npm packages and standalone binaries. `pi-client`, `pi-protocol`, and `pi-server` are development dependencies of coding-agent, not runtime dependencies. The local SDK and stdio RPC API are unchanged.

## Shared Deno runtime package (dnr)

The local Deno build uses [dnr](../../../../dnr/README.md): `dnc` packages the application,
and the shared `dnr` executable runs it. It replaces the former `build:binary:deno`
and `deno compile` workflow. The existing Bun release build is unchanged.

Install Node.js and put the dnr project's `dist/dnc` and `dist/dnr` on `PATH`.
From the Pi repository root:

```bash
npm ci --ignore-scripts
# Fetch catalog data after changing branches or updating the model generator.
npm run generate:models
npm --prefix packages/coding-agent run build:dnp
```

The build validates existing model data and otherwise runs offline. It uses the upstream
TypeScript compiler to emit JS and rewrite `.ts` imports, then esbuild to bundle and minify
the CLI, SDK, RPC entry, provider chunks, OAuth implementations, and image worker. Code splitting
retains lazy provider loading. Chord is bundled for this target. Photon JS/WASM and jiti/Babel
retain their required package-relative layout; jiti compiles user extensions at runtime.
Documentation and extension examples retain their original source format.

The build supports native macOS ARM64 and Linux x86_64 hosts. Use `DNC_BIN=/path/to/dnc`
or pass `-- --dnc /path/to/dnc --output /path/to/pi.dnp` to override the tool or output.
The shared runtime itself is never embedded or built by Pi.

Output:

```text
packages/coding-agent/dist/dnr/
├── pi.dnp
├── pi.dnp.files.txt
├── pi.dnp.tree.txt
└── native/
    └── darwin/prebuilds/darwin-arm64/darwin-platform.node
```

Linux produces `native/linux/prebuilds/linux-x64/linux-platform-x11.node` instead.
dnr cannot load native libraries from ZIP, so keep the `native/` directory beside `pi.dnp`.
The application includes no native libraries in its ZIP and never extracts them at startup.
The optional native clipboard/helper functionality uses the sidecar; Linux Wayland clipboard
commands still need the corresponding system tools.

Run or install both artifacts together (requires `dnr` on `PATH`):

```bash
packages/coding-agent/dist/dnr/pi.dnp --version
packages/coding-agent/dist/dnr/pi.dnp

install -d "$HOME/.local/lib/pi-dnr" "$HOME/.local/bin"
install -m 755 packages/coding-agent/dist/dnr/pi.dnp "$HOME/.local/lib/pi-dnr/pi.dnp"
cp -R packages/coding-agent/dist/dnr/native "$HOME/.local/lib/pi-dnr/"
ln -sfn "$HOME/.local/lib/pi-dnr/pi.dnp" "$HOME/.local/bin/pi"
export PATH="$HOME/.local/bin:$PATH"
```

Rebuild and replace the package and matching sidecar to update. The dnp runs with dnr's full
permissions, preserves the caller's working directory, and needs no Node.js or stock Deno
installation to execute. Keep it in a dedicated directory because dnr overlays ZIP paths on
the package's real parent directory. Extension-managed dependencies and external tools retain
their own installation requirements.

Run the offline artifact smoke test from the repository root:

```bash
PI_DNP_TEST_PACKAGE=packages/coding-agent/dist/dnr/pi.dnp node --test scripts/dnp-smoke.test.mjs
```

It copies the package and native helper outside the checkout and tests a TypeScript extension,
the two DeepSeek catalogs, Photon resizing, a tool call through a local faux provider, session
storage, HTML export, CLI startup, and caller cwd. It does not contact paid model APIs.
It also compares the emitted file inventory against the ZIP central directory and runs through
a symlink with only dnr and system commands on PATH.

Validated on macOS ARM64 on 2026-09-18 using Pi 0.85.1 and dnc 0.1.0: the artifact smoke
test and `npm run check` passed. A separate real PTY run accepted a typed prompt, displayed
the faux provider's reply, and exited with Ctrl-D. The native helper loaded successfully;
clipboard contents were not changed. Linux execution and paid-provider requests were not tested.

## Forking / Rebranding

Configure via `package.json`:

```json
{
  "piConfig": {
    "name": "pi",
    "configDir": ".pi"
  }
}
```

Change `name`, `configDir`, and `bin` field for your fork. Affects CLI banner, config paths, and environment variable names.

## Path Resolution

Three execution modes: npm install, standalone binary, tsx from source.

**Always use `src/config.ts`** for package assets:

```typescript
import { getPackageDir, getThemeDir } from "./config.js";
```

Never use `__dirname` directly for package assets.

## Debug Command

`/debug` (hidden) writes to `~/.pi/agent/pi-debug.log`:
- Rendered TUI lines with ANSI codes
- Last messages sent to the LLM

## Testing

```bash
./test.sh                         # Run non-LLM tests (no API keys needed)
npm test                          # Run all tests
npm test -- test/specific.test.ts # Run specific test
```

### Published package smoke test

After building, run `npm run check:package-install`. It packs the public packages and installs only coding-agent as a direct dependency in a temporary directory outside the repository. Local tarball overrides select declared transitive dependencies without installing development-only packages. The check verifies SDK imports and CLI startup without credentials or model requests.

`npm run check` also checks runtime dependency declarations and rejects excluded development sources pulled into a package's build through imports.

## Project Structure

```
packages/
  ai/           # LLM provider abstraction
  agent/        # Agent loop and message types  
  tui/          # Terminal UI components
  coding-agent/ # CLI and interactive mode
```

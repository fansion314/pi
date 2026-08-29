# Development

See [AGENTS.md](https://github.com/earendil-works/pi-mono/blob/main/AGENTS.md) for additional guidelines.

## Setup

```bash
git clone https://github.com/earendil-works/pi-mono
cd pi-mono
npm install
npm run build
```

Run from source:

```bash
/path/to/pi-mono/pi-test.sh
```

The script can be run from any directory. Pi keeps the caller's current working directory.

## macOS Deno Standalone Binary

Install the build prerequisites and locked dependencies from the repository root:

```bash
brew install node deno
npm ci --ignore-scripts
```

Build the executable:

```bash
npm --prefix packages/coding-agent run build:binary:deno
```

The build supports Apple silicon and Intel macOS hosts and writes the executable to
`packages/coding-agent/dist/pi`. The executable embeds its runtime assets, documentation,
extension examples, image support, and native macOS helpers. Deno permissions are compiled with `--allow-all`
because Pi needs filesystem, subprocess, environment, and network access.

Install it for the current user:

```bash
install -d "$HOME/.local/bin"
install -m 755 packages/coding-agent/dist/pi "$HOME/.local/bin/pi"
export PATH="$HOME/.local/bin:$PATH"
pi --version
```

Add the `PATH` export to `~/.zshrc` to keep it across terminal sessions. Rebuild and rerun the
`install` command to replace an existing local binary.

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

## Project Structure

```
packages/
  ai/           # LLM provider abstraction
  agent/        # Agent loop and message types  
  tui/          # Terminal UI components
  coding-agent/ # CLI and interactive mode
```

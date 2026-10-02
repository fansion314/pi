# Pi DNR 1.0.0-1

Synchronizes the DNR fork with upstream Pi v1.0.0. Use dnr 0.4.0 or newer.

- Makes fullscreen the default TUI mode. Set `tuiMode` to `regular` or pass
  `--tui-mode regular` to retain terminal scrollback.
- Reduces Codemode prompt size, improves recovery messages, and adds
  `models.generateImages()`.
- Adds Radius sign-in and MCP setup, Anthropic copy-code login, and
  header-only quiet startup.
- Hardens MCP OAuth issuer validation, per-server credentials, and step-up
  scopes; restores deferred tools on resume and reload.
- Includes upstream terminal rendering, theme, autocomplete, and transcript
  memory fixes, and the experimental durable client/server migration.
- Preserves DeepSeek Responses (`deepseek`) and Chat Completions
  (`deepseek-completions`) using `DEEPSEEK_API_KEY`.
- Keeps Together DeepSeek V4 Pro reasoning controls for the current
  `deepseek-ai/DeepSeek-V4-Pro-0813` model ID.
- Builds the Codemode and MCP workspaces and packages the Codemode worker and
  QuickJS WASM resource.
- Retains DNP v4 with Linux x64 and macOS ARM64 native helpers.

GitHub Actions builds the Arch package, cross-platform `pi.dnp`, and macOS ARM64
Homebrew archive. The Arch package installs verified Linux groups under
`/usr/lib/pi`; `/usr/bin/pi` is a relative symlink. Runtime installation remains
separate. Checksums and build records accompany the release assets.

The DNR-only tag is `pi-dnr-v1.0.0-1`; upstream tags and npm releases are unchanged.

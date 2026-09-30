# Pi DNR 0.99.1-1

Synchronizes the DNR fork with upstream Pi v0.99.1. Use dnr 0.4.0 or newer.

- Adds upstream Codemode and MCP, terminal system themes, virtual models, and
  classifier models from v0.99.0.
- Adds GPT-6.1 Sol and makes it the default OpenAI Codex model.
- Includes the upstream bundled OpenAI sign-in fix and all lazy OAuth modules.
- Preserves DeepSeek Responses (`deepseek`) and Chat Completions
  (`deepseek-completions`) using `DEEPSEEK_API_KEY`.
- Builds the Codemode and MCP workspaces and packages the Codemode worker and
  QuickJS WASM resource.
- Retains DNP v4 with Linux x64 and macOS ARM64 native helpers.

GitHub Actions builds the Arch package, cross-platform `pi.dnp`, and macOS ARM64
Homebrew archive. The Arch package installs verified Linux groups under
`/usr/lib/pi`; `/usr/bin/pi` is a relative symlink. Runtime installation remains
separate. Checksums and build records accompany the release assets.

The DNR-only tag is `pi-dnr-v0.99.1-1`; upstream tags and npm releases are unchanged.

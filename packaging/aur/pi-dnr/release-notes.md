# Pi DNR 0.99.2-1

Synchronizes the DNR fork with upstream Pi v0.99.2. Use dnr 0.4.0 or newer.

- Updates MCP tool discovery and deferred connections so default servers no
  longer block the first prompt.
- Adds MCP provider-login authentication, custom OAuth client names, and
  Anthropic workload identity federation.
- Includes upstream fixes for model catalog lookup, tool rendering, provider
  retries, and strict tool schemas.
- Preserves DeepSeek Responses (`deepseek`) and Chat Completions
  (`deepseek-completions`) using `DEEPSEEK_API_KEY`.
- Builds the Codemode and MCP workspaces and packages the Codemode worker and
  QuickJS WASM resource.
- Retains DNP v4 with Linux x64 and macOS ARM64 native helpers.

GitHub Actions builds the Arch package, cross-platform `pi.dnp`, and macOS ARM64
Homebrew archive. The Arch package installs verified Linux groups under
`/usr/lib/pi`; `/usr/bin/pi` is a relative symlink. Runtime installation remains
separate. Checksums and build records accompany the release assets.

The DNR-only tag is `pi-dnr-v0.99.2-1`; upstream tags and npm releases are unchanged.

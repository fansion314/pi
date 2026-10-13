# Pi DNR 1.2.0-1

Synchronizes the DNR fork with upstream Pi v1.2.0. Use dnr 0.4.0 or newer.

- Adds per-key OpenRouter model lists, published configuration schemas,
  `PI_CLIPBOARD_OSC52=1`, and Codemode timing and input constraints.
- Includes upstream provider retries, MCP resource and OAuth fixes, terminal
  rendering fixes, and safer extension-triggered runs.
- Preserves DeepSeek Responses (`deepseek`) and Chat Completions
  (`deepseek-completions`) using `DEEPSEEK_API_KEY`.
- Keeps Azure Foundry DeepSeek on Chat Completions with Azure-specific thinking
  levels, alongside the separate DeepSeek Responses provider.
- Retains DNP v4 with Linux x64 and macOS ARM64 native helpers, the DNR ESM
  launcher, and the self-contained Codemode worker. Follows upstream removal
  of the unpublished experimental server/client/plugin stack and Chord dependency.

Extension handlers for `before_agent_start` must check
`event.messageType === "user"` before accessing `prompt` or `images`.
Theme schemas now use `https://pi.dev/schemas/theme.schema.json`; put reusable
colors in `vars` and remove unsupported metadata. `pi mcp list --json` now
reports `resources: true` instead of resource counts. See the upstream 1.2.0
changelog for the complete migration notes.

GitHub Actions builds the Arch package, cross-platform `pi.dnp`, and macOS ARM64
Homebrew archive. The Arch package installs verified Linux groups under
`/usr/lib/pi`; `/usr/bin/pi` is a relative symlink. Runtime installation remains
separate. Checksums and build records accompany the release assets.

The DNR-only tag is `pi-dnr-v1.2.0-1`; upstream tags and npm releases are unchanged.

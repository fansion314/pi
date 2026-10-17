# Pi DNR 1.3.0-1

Synchronizes the DNR fork with upstream Pi v1.3.0. Use dnr 0.4.0 or newer.

- Adds configurable session sharing destinations and cache-preserving GPT-6
  thinking-level changes.
- Updates Kimi Code to Chat Completions, drops another model's thinking on model
  switches, and restores active tools when resuming sessions.
- Includes upstream provider, retry, tool argument validation, and Codemode
  cancellation fixes; internal Pi dependencies use exact release versions.
- Preserves DeepSeek Responses (`deepseek`) and Chat Completions
  (`deepseek-completions`) using `DEEPSEEK_API_KEY`.
- Keeps Azure Foundry DeepSeek on Chat Completions with Azure-specific thinking
  levels, alongside the separate DeepSeek Responses provider.
- Retains DNP v4 with Linux x64 and macOS ARM64 native helpers, the DNR ESM
  launcher, schemas, resources, and the self-contained Codemode worker.

Custom `models.json` base URLs for `kimi-coding` must now include `/v1`.
See the upstream 1.3.0 changelog for the complete changes.

GitHub Actions builds the Arch package, cross-platform `pi.dnp`, and macOS ARM64
Homebrew archive. The Arch package installs verified Linux groups under
`/usr/lib/pi`; `/usr/bin/pi` is a relative symlink. Runtime installation remains
separate. Checksums and build records accompany the release assets.

The DNR-only tag is `pi-dnr-v1.3.0-1`; upstream tags and npm releases are unchanged.

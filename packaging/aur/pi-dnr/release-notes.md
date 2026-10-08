# Pi DNR 1.1.0-1

Synchronizes the DNR fork with upstream Pi v1.1.0. Use dnr 0.4.0 or newer.

- Adds OSC 7501 program status reporting, Claude Haiku 5.5, additive and
  subtractive tool selection, image classification, and native llama.cpp classifiers.
- Includes upstream tool patterns, MCP cancellation and authentication fixes,
  terminal rendering fixes, and provider retry and context-limit improvements.
- Preserves DeepSeek Responses (`deepseek`) and Chat Completions
  (`deepseek-completions`) using `DEEPSEEK_API_KEY`.
- Keeps Azure Foundry DeepSeek on Chat Completions with Azure-specific thinking
  levels, alongside the separate DeepSeek Responses provider.
- Retains DNP v4 with Linux x64 and macOS ARM64 native helpers and the DNR ESM
  launcher. Includes the upstream self-contained Codemode worker.

The upstream Azure provider is now named `azure`. Rename `azure-openai-responses`
in auth, model, and settings files, or sign in again; `AZURE_OPENAI_*` variables
remain unchanged.

GitHub Actions builds the Arch package, cross-platform `pi.dnp`, and macOS ARM64
Homebrew archive. The Arch package installs verified Linux groups under
`/usr/lib/pi`; `/usr/bin/pi` is a relative symlink. Runtime installation remains
separate. Checksums and build records accompany the release assets.

The DNR-only tag is `pi-dnr-v1.1.0-1`; upstream tags and npm releases are unchanged.

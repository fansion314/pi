# Pi DNR 0.87.1-2

Updated to [upstream Pi v0.87.1](https://github.com/earendil-works/pi/releases/tag/v0.87.1),
including Claude Opus 5.5, GPT-6 Sol/Luna and Grok 4.7 support, canonical session
context edits, extension lifecycle boundaries and per-model image input limits.
DeepSeek Responses and the separate `deepseek-completions` catalog are retained.
The Copilot Opus 5.5 effort override now also applies when the live catalog
already contains the model.

The update includes upstream 0.87.0 API changes. Custom integrations using
`shouldStopAfterTurn`, direct assignment to `session.agent.state.messages`, or
extension boundary events should review the upstream coding-agent and agent changelogs.

## Downloads

- `pi.dnp`: one format-v3 application with Linux x64 glibc and macOS ARM64 native
  groups. Requires dnr 0.3.0 or newer; no runtime is embedded.
- `pi-dnr-0.87.1-2-x86_64.pkg.tar.zst`: Arch/CachyOS package with the DNP and
  verified Linux native groups under `/usr/lib/pi`; `/usr/bin/pi` is a relative
  symlink. Pacman owns the pre-extracted sidecar.
- SHA-256 checksums and build-environment records accompany the artifacts.

Install a runtime provider satisfying `dnr>=0.3.0`, then use
`paru -U pi-dnr-0.87.1-2-x86_64.pkg.tar.zst`, or the `pi-dnr-bin` recipe for the
same verified payload under that package name.

## Build and compatibility

This packaging revision migrates Pi to DNP v3 and requires dnr 0.3.0 or newer.
It includes native-group installation and runtime code/transpilation caches.
The existing 0.87.1-1 v2 release remains unchanged.

The official Arch build uses standalone dnc 0.3.0 without installing CEF, GTK or
WebKitGTK. It validates both platform payloads, hashes, read-only sidecars and
Node-API loading. End users need a compatible shared runtime.

Upstream's persistent Node compile cache remains enabled for Node bundles.
DNP uses an ESM launcher because dnr 0.3.0 does not implement Node's compile-cache
API. Cold-cache and adjacent-installation smoke tests cover native helpers,
TypeScript extensions, Photon resizing, faux-provider bash calls, sessions and
HTML export. A real macOS ARM64 PTY test checked interactive input, tool execution
and exit. `npm run check` passed. The isolated offline suite found two failures
(Copilot effort metadata and the retained development page's navigation); both
were fixed, with 132 AI tests and the documentation test passing on rerun.
The other offline suites passed. No paid model API was used.

macOS ARM64 native loading and both cache and sidecar runtime smoke tests passed.
The release workflow validates the Arch package and Linux Node-API loading;
this does not constitute a Linux DNR interactive test.

This fork publishes the DNR distribution as `pi-dnr-v0.87.1-2`; it does not
publish upstream npm packages or move an existing version tag.

## V3 local validation

On Linux x86_64, the rebuilt v3 package passed structure and real Node-API checks,
plus cold/warm cache and adjacent-installation smoke tests with dnr 0.3.0.
`npm run check` passed after model-data hydration. These tests exercised the
local faux provider only. macOS and PTY observations above belong to earlier
validation; they were not repeated for this packaging revision.

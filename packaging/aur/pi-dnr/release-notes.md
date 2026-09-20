# Pi DNR 0.86.1-1

Updated to [upstream Pi v0.86.1](https://github.com/earendil-works/pi/releases/tag/v0.86.1),
with Meta/Muse provider support, clipboard fixes for headless/WSL sessions, better
`/bug` handling, z.ai context-overflow detection and the Cerebras strict-schema fix.
DeepSeek Responses and the separate `deepseek-completions` catalog are retained.

## Downloads

- `pi.dnp`: one format-v2 application with Linux x64 glibc and macOS ARM64 native
  groups. Requires dnr 0.2.0 or newer; no runtime is embedded.
- `pi-dnr-0.86.1-1-x86_64.pkg.tar.zst`: Arch/CachyOS package with the DNP and
  verified Linux native groups under `/usr/lib/pi`; `/usr/bin/pi` is a relative
  symlink. Pacman owns the pre-extracted sidecar.
- SHA-256 checksums and build-environment records accompany the artifacts.

Install a runtime provider satisfying `dnr>=0.2.0`, then use
`paru -U pi-dnr-0.86.1-1-x86_64.pkg.tar.zst`, or the `pi-dnr-bin` recipe for the
same verified payload under that package name.

## Build and compatibility

The official Arch build uses standalone dnc without installing CEF, GTK or
WebKitGTK. It validates both platform payloads, hashes, read-only sidecars and
Node-API loading. End users need a compatible shared runtime.

Upstream's persistent Node compile cache remains enabled for Node bundles.
DNP uses an ESM launcher because dnr 0.2.0 does not implement Node's compile-cache
API. Cold-cache and adjacent-installation smoke tests cover native helpers,
TypeScript extensions, Photon resizing, faux-provider bash calls, sessions and
HTML export. A real PTY test checks interactive input, tool execution and exit.
`npm run check` and 85 targeted upstream tests passed (4 conditional skips).

Linux native execution was verified. The macOS ARM64 payload is included and
hash-checked, but this Linux run does not constitute native macOS validation.

This fork publishes the DNR distribution as `pi-dnr-v0.86.1-1`; it does not
publish upstream npm packages or move an existing version tag.

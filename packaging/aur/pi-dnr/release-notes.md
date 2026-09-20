# Pi DNR 0.86.0-2

Packaging update for upstream Pi 0.86.0; no npm release or application version bump.
This fork retains DeepSeek Responses and the separate DeepSeek completions catalog.

- `pi.dnp` uses format v2 and contains explicitly declared Linux x64 glibc and
  macOS ARM64 native groups. Running requires dnr 0.2.0 or newer.
- `pi-dnr-0.86.0-2-x86_64.pkg.tar.zst` installs the DNP and verified Linux sidecar
  under `/usr/lib/pi`, with `/usr/bin/pi` as a relative symlink. Pacman owns both.
- Building uses standalone dnc; the Arch build container no longer installs
  either GUI runtime or CEF/GTK/WebKitGTK just to package the CLI application.
- Cold launches prepare persistent groups; warm launches reuse them. Arch
  installation supplies adjacent groups in advance and avoids a user cache.

Install one runtime provider satisfying `dnr>=0.2.0`, then install the pacman
archive or use the `pi-dnr-bin` recipe. Application packages contain no runtime.
Checksums accompany both the pacman package and the portable DNP.

CI verifies package structure, hashes, sidecar layout and Node-API loading without
dnr. Full local runtime smoke tests cover CLI, TypeScript extensions, Photon image
resizing, faux-provider bash calls, sessions, HTML export and persistent caches.
The macOS payload is included and verified as package content; Linux testing does
not establish native macOS runtime compatibility.

This packaging release uses tag `pi-dnr-v0.86.0-2`; the existing upstream-style
`v0.86.0` tag and release remain unchanged.

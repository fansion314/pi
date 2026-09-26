# Pi DNR 0.87.1-3

This packaging revision moves the existing Pi 0.87.1 application to DNP v4.
Use dnr 0.4.0 or newer, and upgrade the runtime and application package together.
The previous v3 release remains available under its original tag.

- CLI packages omit optional desktop metadata and icons.
- Linux x64 glibc and macOS ARM64 native helpers remain in declared groups.
- The Arch package installs verified Linux groups in the v4 sidecar under
  `/usr/lib/pi`; `/usr/bin/pi` remains a relative symlink. User data is preserved.
- Build and installation inspection use standalone dnc 0.4.0. No GUI runtime
  is required on the build host.

Assets: `pi.dnp`, `pi-dnr-0.87.1-3-x86_64.pkg.tar.zst`, checksums, and build records.
The `pi-dnr-bin` recipe repackages the same verified payload.

The DNR-only tag is `pi-dnr-v0.87.1-3`. Application and npm versions are unchanged;
the retained DeepSeek providers and upstream Pi features are unchanged.
Linux validation covers structure, real Node-API, cache/sidecar deployment,
TypeScript extensions, Photon WASM, faux-provider bash calls, sessions and HTML
export. macOS execution is not newly validated in this revision.

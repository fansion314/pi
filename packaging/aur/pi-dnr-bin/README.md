# pi-dnr-bin

Prebuilt Pi 0.86.0 for Linux x86_64, downloaded from this fork's GitHub Release.
It installs `/usr/bin/pi` without compiling Pi, Deno or V8.

First install exactly one runtime package:

| Runtime package | Backend | Runtime compilation |
| --- | --- | --- |
| `dnr` | system CEF | Yes |
| `dnr-webview` | WebKitGTK | Yes |
| `dnr-bin` | system CEF | No |
| `dnr-webview-bin` | WebKitGTK | No |

All satisfy `dnr>=0.1.0`. An already installed provider is reused; Pi does not
force a backend change. For local recipes that are not registered on AUR, install
your chosen runtime first so pacman can resolve the dependency normally.

```sh
cd packaging/aur/pi-dnr-bin
makepkg -si
# Or: paru -Bi .
```

The recipe downloads `pi-dnr-0.86.0-1-x86_64.pkg.tar.zst` and its `.sha256` from
the matching GitHub Release. It checks the archive name and SHA-256 before
extracting files and regenerates pacman metadata for the `pi-dnr-bin` name.
The checksum comes from the same HTTPS release; it is not independently signed
or hardcoded into the tag because CI builds the archive after tagging.

This package provides `pi-dnr` and `pi-coding-agent` and conflicts with their
other implementations. It preserves existing `~/.pi` configuration and sessions.
A manually installed `/usr/local/bin/pi` can take precedence over `/usr/bin/pi`.

Node.js/npm are not needed for ordinary use. Optional npm/Git are useful for
installing extensions; optional `wl-clipboard` and `xclip` support clipboard
integration. See [the source recipe](../pi-dnr/README.md) for more details.

`release-dnr.yml` builds the source package in the official Arch container after
a version-tag push. It installs prebuilt dnr from the dnr GitHub Release using
pacman, without requiring AUR registration or skipping dependency checks. The
same Pi application must pass offline smoke tests on CEF and WebView before
publication. No npm package or upstream Pi announcement is published by this
workflow.


## Validation (2026-09-18)

Local validation used the previously built and tested `pi-dnr` package. A wrong
checksum was rejected before extraction, the correct checksum passed, and a
real makepkg repackaging produced `pi-dnr-bin` with the expected dependencies,
provides and conflicts. Its `/usr/bin/pi` is byte-identical to the source package.
The generated `.SRCINFO`, workflow actionlint, Bash syntax checks and repository
`npm run check` passed. The old generated source snapshot was moved outside the
Pi checkout to avoid Biome treating its nested config as a project config.

No system package was installed during these checks. The remote tagged build
and release status is recorded in GitHub Actions; local repackaging alone does
not establish CI success.

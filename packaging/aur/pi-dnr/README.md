# pi-dnr for Arch Linux / CachyOS

Pi 0.86.1, packaging revision 1, uses dnr format v2. Building needs the standalone
`dnc>=0.2.0` package, Git, Node.js, npm, libarchive, libxcb and base-devel. It does
not need dnr, CEF, GTK or WebKitGTK. Running the installed application needs one
runtime provider satisfying `dnr>=0.2.0`, plus the dependencies in `PKGBUILD`.

Normal `makepkg -si` also installs runtime dependencies on the local machine.
For a build-only environment, install **all** `makedepends`, verify them with
`pacman -T`, and use `makepkg --nodeps`; this deliberately leaves runtime
dependencies to the destination machine. The release container does exactly
this and downloads only the standalone dnc release package.

```sh
# Normal user, on a machine that will also run Pi:
cd packaging/aur/pi-dnr
makepkg -si
pi --version
```

The source revision is pinned in the recipe. `npm ci --ignore-scripts` uses the
committed lockfile; the model-data hydration step accesses provider catalogs.
The build compiles Pi and the small Linux clipboard helper, uses the reviewed
macOS ARM64 prebuild from Git, and asks dnc to create one cross-platform `pi.dnp`.
It does not compile or embed Deno/V8. The native variants are explicitly declared
as Node-API groups. The included DOOM example build script and its companion
resources have a separate group; its WASM and license notices are data assets.

`scripts/prepare-dnp-install.mjs` reads the v2 manifest and index with libarchive,
checks SHA-256, and stages the current platform's reviewed groups beside the DNP
**before** makepkg creates the package. It does not execute dnr or native code.
It implements Pi's limited, reviewed group layout; adding other native groups
requires updating its checks. Runtime verification is still mandatory and intact.

Pacman owns this layout:

```text
/usr/bin/pi -> ../lib/pi/pi.dnp
/usr/lib/pi/pi.dnp
/usr/lib/pi/pi.dnp.unpacked/v2/<prefix>/<identity>/linux_x64_glibc/<group>/...
```

The sidecar includes read-only payloads, receipts and readable lock files. Runtime
launches can reuse it without writing a user cache or unpacking into `/usr/bin`.
Upgrades/removals use pacman's file ownership; no root cache or post-install
download is needed. Existing `~/.pi` data is preserved. A manual
`/usr/local/bin/pi` may take precedence; check `command -v pi` when migrating.

`check()` verifies both platform payloads, the index, installation layout and
real Node-API loading using Node, without a GUI runtime. On a runtime-equipped
machine, separately run the complete offline tests:

```sh
PI_DNP_TEST_PACKAGE=/absolute/path/pi.dnp node --test scripts/dnp-package.test.mjs
PATH=/path/to/new/dnr/bin:$PATH PI_DNP_TEST_PACKAGE=/absolute/path/pi.dnp \
  node --test scripts/dnp-smoke.test.mjs
```

The latter checks cold/warm caches and adjacent installation, extensions, image
resizing, the local faux model, bash, sessions and HTML export. No paid model API
is used. One DNP carries Linux x64 glibc and macOS ARM64 payloads; macOS native
execution must still be validated on a Mac.

For local standalone output:

```sh
node scripts/build-dnp.mjs --dnc /path/to/dnc --target all --output dist/pi.dnp
# --target linux-x64 or --target darwin-arm64 creates a single-platform package.
```

Packaging-only releases use `pi-dnr-v0.86.1-1`, independent of the existing
upstream `v0.86.0` tag. Do not move the old tag. The workflow publishes the pacman
package and cross-platform `pi.dnp`, with checksums. The binary recipe requires
those release assets; pushing a branch alone does not publish them or register AUR.

Regenerate metadata with `makepkg --printsrcinfo > .SRCINFO` after recipe changes.

## 0.86.1 validation (2026-09-21)

Synchronized upstream tag v0.86.1 (`13cbf77df`), retaining DeepSeek Responses,
the separate completions provider, and v2 native groups. Node's new compile-cache
launcher remains enabled for Node bundles; DNP uses an ESM launcher because dnr
0.2.0 does not export `enableCompileCache` from `node:module`.

`npm run check` passed. Targeted upstream regressions passed: 48 AI tests (4
conditional skips) and 37 coding-agent tests. The built v2 package passed its
structure/Node-API checks and both cold-cache and adjacent-installation smoke
tests. A real isolated PTY accepted input, ran a faux-provider bash call, showed
the reply and exited 0. No paid model request was made. macOS native execution
was not performed on this Linux host. Logs: `../dnr/dist/validation-pi-0.86.1/`.

### Published artifact and local installation

[Actions run 35523032268](https://github.com/fansion314/pi/actions/runs/35523032268)
completed successfully and published
[Pi DNR 0.86.1-1](https://github.com/fansion314/pi/releases/tag/pi-dnr-v0.86.1-1).
The recorded Arch build environment contains standalone dnc 0.2.0 and no dnr,
CEF, GTK or WebKitGTK packages.

Both the public pacman archive and portable DNP were downloaded and SHA-256
verified. The binary recipe produced `pi-dnr-bin-0.86.1-1` from those assets;
the payload and sidecar passed offline smoke tests, and the downloaded DNP
passed the isolated PTY test. HTTP downloads do not retain the executable bit:
use `chmod +x pi.dnp` for direct execution, or invoke `dnr pi.dnp`.

The local system was upgraded using `paru -U`. `pi --version` reports 0.86.1,
`pacman -Qkk pi-dnr-bin` reports 41 files with none altered, and the installed
DNP is byte-identical to the release. Native groups remain under `/usr/lib/pi`,
with `/usr/bin/pi` as the relative symlink. Tests use isolated config directories;
existing user configuration and sessions are preserved.

## Historical v2 validation (2026-09-21)

On CachyOS x86_64, with dnc/dnr 0.2.0:

- Built a single DNP with both Linux x64 glibc and macOS ARM64 variants.
- `npm run check` passed. Package tests verified platform declarations, content
  hashes, read-only payload modes, preservation of an existing destination and
  real Node-API loading.
- Full offline smoke tests passed on both CEF and WebView, in cold/warm-cache
  and pre-extracted-sidecar modes. Repeated runs preserved native inode/mtime;
  sidecar mode did not create a user cache.
- An isolated source snapshot ran real prepare/build/check/package hooks via
  makepkg, using the standalone dnc. Local dependency lookup was explicitly
  bypassed; this does not claim a clean-container build.
- Both source and binary pacman packages preserve the `/usr/lib/pi` sidecar and
  the relative `/usr/bin/pi` symlink. The binary recipe rejected a wrong digest
  and a wrong checksum filename. The extracted package passed full runtime
  smoke tests without regenerating its sidecar.

macOS payloads were included and hash-checked, but were not executed on Linux.
No system package, user configuration or paid provider was changed. Evidence is
under `../dnr/dist/validation-v0.2.0/pi-*`; packaging CI runs on the next packaging
tag, separately from the dnr runtime release.

## Historical v1 validation (2026-09-18)

Validated on CachyOS x86_64 with dnr/dnc 0.1.0:

- `npm run check` passed without modifying application sources or lockfiles.
- A fresh `git archive` snapshot ran the recipe's `prepare()` (locked npm install
  with lifecycle scripts disabled and model-data hydration), then real makepkg
  `build()`, `check()` and `package()` hooks. This host's dnr/dnc are manually
  installed, so `makepkg --noextract --nodeps --force` bypassed only pacman's
  dependency lookup and reused that prepared snapshot; no runtime was compiled.
- The existing offline DNP smoke test passed with both system-CEF and WebView
  runtimes, including a local test provider, native-helper cleanup, extensions,
  image resizing, shell tools, sessions and HTML export.
- `.SRCINFO` matches `makepkg --printsrcinfo`. Pacman metadata declares the
  runtime dependency, optional tools and conflict with `pi-coding-agent`.
- The package contains `/usr/bin/pi`, its license and README. The installed
  payload is byte-identical to the built DNP, has mode 0755, and reports `0.85.1`
  when launched outside the checkout.

No system package was installed, no user configuration was changed, and no paid
model API was used. This was not a clean-chroot or AUR-server installation test.
The original local evidence was moved to `../dnr/dist/validation-pi-aur/`
to keep its nested source/configuration files outside this checkout.

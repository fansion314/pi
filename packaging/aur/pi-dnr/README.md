# pi-dnr for Arch Linux / CachyOS

`pi-dnr` follows the upstream Pi version, starting at `0.85.1`. The recipe
downloads `https://github.com/fansion314/pi.git` at tag `v0.85.1` and installs
the executable application package as `/usr/bin/pi`.

Install any one of `dnr`, `dnr-webview`, `dnr-bin` or `dnr-webview-bin` before
building. All include `dnr` and `dnc` and satisfy `dnr>=0.1.0` for building and
running. Pi reuses the installed provider and does not force a backend change.
A manually installed runtime does not satisfy pacman's dependency database.
Choose [`pi-dnr-bin`](../pi-dnr-bin/README.md) to install Pi without compiling it.

```sh
# From the Pi checkout, as a normal user with base-devel installed:
cd packaging/aur/pi-dnr
makepkg -si
pi --version
```

This builds Pi's TypeScript/JavaScript and a small Linux clipboard helper, then
uses the installed `dnc` to create the application package. It does not build
Deno, dnr, or V8. Git, Node.js and npm are build dependencies; Node.js is not
required to run the packaged Pi. The build uses `npm ci --ignore-scripts` and
the committed lockfile, then the existing model-data hydration script. Network
access is needed for npm dependencies and model metadata. Package dependency
install scripts are not run.

`libxcb` is required by the bundled Linux native helper. `bash`, `ripgrep` and
`fd` support the agent's shell and search tools. Optional `wl-clipboard` and
`xclip` provide clipboard integration; Git/npm are useful for installing
extensions. Other compilers and tools needed by the user's projects remain
the user's responsibility.

The package provides and conflicts with `pi-coding-agent`, since both install
the `pi` command. If `/usr/local/bin/pi` is already installed manually, it may
take precedence over `/usr/bin/pi`; check `command -v pi` when migrating.
Pacman does not manage the manual copy or the user's `~/.pi` data.

`check()` runs the existing offline DNP smoke test outside the checkout. It
covers CLI startup, native extraction/cleanup, TypeScript extensions, image
resizing, a local test provider, shell tools, sessions and HTML export. It does
not call a paid model provider. The same application supports either runtime
backend; ordinary terminal use does not open a GUI window.

This directory contains the AUR submission files. Update metadata after changing
the recipe:

```sh
makepkg --printsrcinfo > .SRCINFO
```

New upstream versions update `pkgver` and reset `pkgrel` to `1`; packaging-only
changes increment `pkgrel`. Publish the matching GitHub tag before submitting
the recipe to AUR. Adding these files to GitHub does not register an AUR package.


## Validation (2026-09-18)

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

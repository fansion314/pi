# Pi DNR v0.85.1

Pi 0.85.1 packaged as a single executable application for the shared dnr runtime.

- `pi-dnr-0.85.1-1-x86_64.pkg.tar.zst` installs the `pi` command on Arch Linux / CachyOS.
- Choose any one of `dnr`, `dnr-webview`, `dnr-bin` or `dnr-webview-bin` (version 0.1.0 or newer).
- The `pi-dnr-bin` recipe downloads this prebuilt package without compiling Pi or the runtime.
- The package includes the application, native helper, assets and dependency license notices; it does not bundle a runtime.

Install your preferred runtime first, then install this package with
`sudo pacman -U pi-dnr-0.85.1-1-x86_64.pkg.tar.zst`, or use the local/AUR recipe.
Checksums and build environment records accompany the release assets.

CI uses the official Arch Linux container and prebuilt dnr packages from GitHub.
The application is tested against both system-CEF and WebView with the offline
DNP smoke test: startup, native extraction/cleanup, extensions, image resizing,
shell tools, session storage and HTML export. It does not call a paid model API.

This is the DNR distribution of upstream Pi 0.85.1; it does not publish npm
packages or change upstream Pi version numbers.

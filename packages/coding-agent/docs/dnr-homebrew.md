# Pi DNR on Homebrew

```sh
brew tap fansion314/dnr
brew trust fansion314/dnr
brew install pi-dnr
pi --version
```

The unified tap is https://github.com/fansion314/homebrew-dnr. Requires Apple
Silicon and macOS 15+. The formula depends on dnr, ripgrep and fd, prepares the
DNP native sidecar inside the Cellar, and provides a `pi` launcher using the
stable Homebrew dnr path. User settings, authentication and sessions are kept.
Remove older manual `pi` executables from earlier PATH entries after verification.

`release-dnr-macos.yml` uses a native ARM64 runner, Node 24, locked dependencies,
model-data hydration, the macOS native helper build, and the existing DNP smoke
tests. It publishes a separate macOS archive; it does not replace the universal
`pi.dnp` or Linux package. This is a DNR packaging release, not an npm release.

```sh
gh workflow run release-dnr-macos.yml --ref main -f release_tag=pi-dnr-v0.87.1-3 -f package_revision=1
```

The source must descend from the existing tag. Increase `package_revision` for
changed bytes; published assets cannot be overwritten. The unified tap checks
release checksums and tests the Homebrew install before updating automatically.

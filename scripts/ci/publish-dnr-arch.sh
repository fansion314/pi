#!/usr/bin/env bash
set -euo pipefail

tag=${GITHUB_REF_NAME:?missing tag}
[[ $tag =~ ^(pi-dnr-)?v[0-9]+\.[0-9]+\.[0-9]+(-[0-9]+)?$ ]]
source packaging/aur/pi-dnr/PKGBUILD
[[ v$pkgver == "$tag" || pi-dnr-v$pkgver-$pkgrel == "$tag" ]]
archive="pi-dnr-$pkgver-$pkgrel-x86_64.pkg.tar.zst"
notes=packaging/aur/pi-dnr/release-notes.md
[[ -f $notes && -f release-assets/$archive ]]
remote_commit=$(git ls-remote origin "refs/tags/$tag^{}" | cut -f1)
if [[ -z $remote_commit ]]; then
    remote_commit=$(git ls-remote origin "refs/tags/$tag" | cut -f1)
fi
[[ $remote_commit == "$GITHUB_SHA" ]]
(cd release-assets && sha256sum --check "$archive.sha256" && sha256sum --check pi.dnp.sha256)

if gh release view "$tag" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
    gh release edit "$tag" --repo "$GITHUB_REPOSITORY" \
        --title "Pi DNR $tag" --notes-file "$notes"
else
    gh release create "$tag" --repo "$GITHUB_REPOSITORY" --verify-tag --draft \
        --title "Pi DNR $tag" --notes-file "$notes"
fi
# Existing public bytes are immutable. New signatures are append-only.
existing=$(mktemp -d)
trap 'rm -rf "$existing"' EXIT
gh release view "$tag" --repo "$GITHUB_REPOSITORY" --json assets --jq '.assets[].name' > "$existing/names"
for asset in release-assets/*; do
    [[ -f $asset ]] || continue
    name=${asset##*/}
    if grep -Fxq "$name" "$existing/names"; then
        gh release download "$tag" --repo "$GITHUB_REPOSITORY" --pattern "$name" --dir "$existing"
        cmp "$asset" "$existing/$name" || { echo "Refusing to overwrite $name; publish a new packaging revision" >&2; exit 1; }
    else
        gh release upload "$tag" "$asset" --repo "$GITHUB_REPOSITORY"
    fi
done
gh release edit "$tag" --repo "$GITHUB_REPOSITORY" --draft=false --latest

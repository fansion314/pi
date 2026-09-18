#!/usr/bin/env bash
set -euo pipefail

tag=${1:?usage: build-dnr-arch.sh tag commit dnr-version}
commit=${2:?missing commit}
dnr_version=${3:?missing dnr version}
[[ $tag =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]
[[ $commit =~ ^[0-9a-f]{40}$ ]]
[[ $dnr_version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
recipe="$root/packaging/aur/pi-dnr/PKGBUILD"
stage="$root/.artifacts/ci-pi-dnr"
output="$root/.artifacts/dnr-release"
runtime="$stage/runtimes"

if (( EUID == 0 )); then
    source "$recipe"
    dependencies=()
    for dependency in "${depends[@]}"; do
        [[ $dependency == dnr* ]] || dependencies+=("$dependency")
    done
    pacman -Syu --noconfirm --needed base-devel git curl ca-certificates \
        cef gtk3 libxi libx11 webkit2gtk-4.1 libsoup3 \
        "${dependencies[@]}" "${makedepends[@]}"
    mkdir -p "$runtime" "$stage/src" "$output" /cache/npm
    for variant in dnr dnr-webview; do
        archive="$variant-$dnr_version-1-x86_64.pkg.tar.zst"
        url="https://github.com/fansion314/dnr/releases/download/v$dnr_version/$archive"
        printf 'Downloading runtime package: %s\n' "$archive"
        curl --fail --location --silent --show-error --connect-timeout 20 --max-time 180 \
            --retry 3 --retry-all-errors --retry-delay 5 --output "$runtime/$archive" "$url"
        curl --fail --location --silent --show-error --connect-timeout 20 --max-time 60 \
            --retry 3 --retry-all-errors --retry-delay 5 --output "$runtime/$archive.sha256" "$url.sha256"
        (
            cd "$runtime"
            read -r digest filename extra < "$archive.sha256"
            [[ $digest =~ ^[0-9a-f]{64}$ && $filename == "$archive" && -z $extra ]]
            printf '%s  %s\n' "$digest" "$archive" | sha256sum --check
        )
    done
    # Install the runtime into pacman's database; makepkg checks dependencies normally.
    pacman -U --noconfirm "$runtime/dnr-$dnr_version-1-x86_64.pkg.tar.zst"
    mkdir -p "$runtime/webview"
    bsdtar -xf "$runtime/dnr-webview-$dnr_version-1-x86_64.pkg.tar.zst" \
        -C "$runtime/webview" usr/bin
    useradd --create-home --uid "${PI_BUILD_UID:?missing build uid}" builder
    chown -R builder:builder "$stage" "$output" /cache
    exec runuser -u builder -- env npm_config_cache=/cache/npm \
        bash "$0" "$tag" "$commit" "$dnr_version"
fi

cd "$root"
[[ $(git rev-parse HEAD) == "$commit" ]]
source "$recipe"
[[ v$pkgver == "$tag" ]]
export SOURCE_DATE_EPOCH
SOURCE_DATE_EPOCH=$(git show -s --format=%ct "$commit")
git archive "$commit" | tar -x -C "$stage/src" --one-top-level=pi
cp "$recipe" "$stage/PKGBUILD"
(
    cd "$stage"
    source ./PKGBUILD
    srcdir="$stage/src"
    prepare
)
cd "$stage"
makepkg --noextract --force --noconfirm
package_file="pi-dnr-$pkgver-$pkgrel-x86_64.pkg.tar.zst"
[[ -f $package_file ]]

# Exercise the same DNP against the other backend without replacing the installed package.
cd "$stage/src/pi"
PATH="$runtime/webview/usr/bin:$PATH" PI_DNP_TEST_PACKAGE="$stage/src/pi/dist/pi.dnp" \
    node --test scripts/dnp-smoke.test.mjs
cd "$stage"
mkdir -p installed
bsdtar -xf "$package_file" -C installed usr/bin
[[ $(PI_OFFLINE=1 PI_TELEMETRY=0 PI_CODING_AGENT_DIR="$stage/test-config" \
    "$stage/installed/usr/bin/pi" --version) == "$pkgver" ]]
cp "$package_file" "$output/"
(
    cd "$output"
    sha256sum "$package_file" > "$package_file.sha256"
)
{
    printf 'tag=%s\ncommit=%s\ndnr_version=%s\n' "$tag" "$commit" "$dnr_version"
    cat /etc/os-release
    node --version
    npm --version
    dnr --version
    "$runtime/webview/usr/bin/dnr" --version
    cat "$runtime/"*.sha256
    pacman -Q
} > "$output/pi-dnr-build-environment.txt"

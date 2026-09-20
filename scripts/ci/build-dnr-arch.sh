#!/usr/bin/env bash
set -euo pipefail

tag=${1:?usage: build-dnr-arch.sh tag commit dnc-version}
commit=${2:?missing commit}
dnc_version=${3:?missing dnc version}
[[ $tag =~ ^(pi-dnr-)?v[0-9]+\.[0-9]+\.[0-9]+(-[0-9]+)?$ ]]
[[ $commit =~ ^[0-9a-f]{40}$ && $dnc_version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
recipe="$root/packaging/aur/pi-dnr/PKGBUILD"
stage="$root/.artifacts/ci-pi-dnr"
output="$root/.artifacts/dnr-release"
packager="$stage/packager"

if (( EUID == 0 )); then
    source "$recipe"
    build_dependencies=()
    for dependency in "${makedepends[@]}"; do
        [[ $dependency == dnc* ]] || build_dependencies+=("$dependency")
    done
    pacman -Syu --noconfirm --needed base-devel curl ca-certificates "${build_dependencies[@]}"
    mkdir -p "$packager" "$stage/src" "$output" /cache/npm
    archive="dnc-$dnc_version-1-x86_64.pkg.tar.zst"
    url="https://github.com/fansion314/dnr/releases/download/v$dnc_version/$archive"
    for suffix in '' '.sha256'; do
        curl --fail --location --silent --show-error --connect-timeout 20 --max-time 180 \
            --retry 3 --retry-all-errors --retry-delay 5 --output "$packager/$archive$suffix" "$url$suffix"
    done
    (
        cd "$packager"
        read -r digest filename extra < "$archive.sha256"
        [[ $digest =~ ^[0-9a-f]{64}$ && $filename == "$archive" && -z $extra ]]
        printf '%s  %s\n' "$digest" "$archive" | sha256sum --check
    )
    pacman -U --noconfirm "$packager/$archive"
    useradd --create-home --uid "${PI_BUILD_UID:?missing build uid}" builder
    chown -R builder:builder "$stage" "$output" /cache
    exec runuser -u builder -- env npm_config_cache=/cache/npm \
        bash "$0" "$tag" "$commit" "$dnc_version"
fi

cd "$root"
[[ $(git rev-parse HEAD) == "$commit" ]]
source "$recipe"
[[ v$pkgver == "$tag" || pi-dnr-v$pkgver-$pkgrel == "$tag" ]]
# Runtime dependencies belong on end-user machines. Check every build dependency
# explicitly, then avoid makepkg pulling dnr and its GUI libraries into this job.
pacman -T "${makedepends[@]}"
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
makepkg --noextract --force --noconfirm --nodeps
package_file="pi-dnr-$pkgver-$pkgrel-x86_64.pkg.tar.zst"
[[ -f $package_file ]]
mkdir -p installed
bsdtar -xf "$package_file" -C installed usr/bin usr/lib/pi
[[ $(readlink installed/usr/bin/pi) == ../lib/pi/pi.dnp ]]
[[ -f installed/usr/lib/pi/pi.dnp && -d installed/usr/lib/pi/pi.dnp.unpacked ]]
cp "$package_file" "$output/"
# Also distribute the same cross-platform standalone application, without a runtime.
cp "$stage/src/pi/dist/pi.dnp" "$output/pi.dnp"
cp "$stage/src/pi/dist/pi.dnp.files.txt" "$output/pi.dnp.files.txt"
(
    cd "$output"
    sha256sum "$package_file" > "$package_file.sha256"
    sha256sum pi.dnp > pi.dnp.sha256
)
{
    printf 'tag=%s\ncommit=%s\ndnc_version=%s\n' "$tag" "$commit" "$dnc_version"
    cat /etc/os-release
    node --version
    npm --version
    dnc --version
    cat "$packager/"*.sha256
    pacman -Q
} > "$output/pi-dnr-build-environment.txt"

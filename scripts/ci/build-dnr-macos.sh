#!/usr/bin/env bash
set -euo pipefail
tag=${RELEASE_TAG:?missing release tag}
revision=${PACKAGE_REVISION:-1}
[[ $tag =~ ^pi-dnr-v([0-9]+\.[0-9]+\.[0-9]+)-([0-9]+)$ ]]
version=${BASH_REMATCH[1]}
release=${BASH_REMATCH[2]}
[[ $revision =~ ^[1-9][0-9]*$ ]]
test "$(uname -sm)" = 'Darwin arm64'
test "$version" = "$(node -p 'JSON.parse(require("fs").readFileSync("packages/coding-agent/package.json")).version')"
out="$PWD/.artifacts/macos-release"
mkdir -p "$out"
npm ci --ignore-scripts --no-audit --no-fund
npm run build:native:darwin
npm run hydrate:model-data
npm run check
(cd packages/ai && node ../../node_modules/vitest/dist/cli.js --run \
  test/anthropic-sse-parsing.test.ts test/providers.test.ts test/env-api-keys.test.ts \
  test/openai-responses-compat.test.ts test/supports-xhigh.test.ts)
node scripts/build-dnp.mjs --target all --output "$out/pi.dnp"
PI_DNP_TEST_PACKAGE="$out/pi.dnp" node --test scripts/dnp-package.test.mjs scripts/dnp-smoke.test.mjs
archive="pi-dnr-$version-$release-macos-arm64-r$revision.tar.gz"
COPYFILE_DISABLE=1 tar -czf "$out/$archive" -C "$out" pi.dnp pi.dnp.files.txt -C "$PWD" LICENSE
(cd "$out" && shasum -a 256 "$archive" > "$archive.sha256")
python3 - "$out/$archive.build.json" <<'PY'
import json, os, subprocess, sys
json.dump({"commit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
           "tag": os.environ["RELEASE_TAG"], "dnr": subprocess.check_output(["dnr", "--version"], text=True).strip()},
          open(sys.argv[1], "w"), indent=2)
PY

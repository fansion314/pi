#!/usr/bin/env bash
# Offline regressions for the released Pi source and retained DNR provider adapters.
set -euo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"
npm run check
if [[ -d apps/p2 ]]; then
    (cd apps/p2 && npm run check)
fi
(
    cd packages/ai
    node ../../node_modules/vitest/dist/cli.js --run \
        test/anthropic-sse-parsing.test.ts test/anthropic-message-threads.test.ts \
        test/providers.test.ts test/env-api-keys.test.ts \
        test/openai-responses-compat.test.ts test/supports-xhigh.test.ts \
        test/azure-models.test.ts test/azure-openai-tool-choice.test.ts \
        test/azure-openai-base-url.test.ts test/azure-openai-responses-reasoning-replay.test.ts \
        test/openai-completions-tool-choice.test.ts
)
(
    cd packages/coding-agent
    node ../../node_modules/vitest/dist/cli.js --run \
        test/auth-login.test.ts test/auth-logout.test.ts test/auth-check.test.ts \
        test/cache-warmer.test.ts test/grep-operations.test.ts test/model-resolver.test.ts
)

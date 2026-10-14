#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const HOOKS_SRC = path.join(PROJECT_ROOT, '.git', 'hooks');

if (!fs.existsSync(HOOKS_SRC)) {
  console.log('[Hooks] No .git directory found. Skipping hook installation.');
  process.exit(0);
}

const commitMsgHookPath = path.join(HOOKS_SRC, 'commit-msg');
const hookContent = `#!/usr/bin/env bash
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "\${HOOK_DIR}/../.." && pwd)"
cd "\${REPO_ROOT}"

if ! command -v node >/dev/null 2>&1; then
  if [ -d "\${HOME}/.nvm/versions/node/v24.15.0/bin" ]; then
    export PATH="\${HOME}/.nvm/versions/node/v24.15.0/bin:\${PATH}"
  elif [ -s "\${HOME}/.nvm/nvm.sh" ]; then
    . "\${HOME}/.nvm/nvm.sh"
    nvm use 24 >/dev/null 2>&1 || true
  fi
fi

MSG_FILE="\${1:-.git/COMMIT_EDITMSG}"

if [ -f "scripts/bump-version.mjs" ] && [ -f "\${MSG_FILE}" ]; then
  node scripts/bump-version.mjs --from-msg-file="\${MSG_FILE}" --stage || true
fi
`;

fs.writeFileSync(commitMsgHookPath, hookContent, { mode: 0o755 });
console.log('[Hooks] Successfully installed .git/hooks/commit-msg');

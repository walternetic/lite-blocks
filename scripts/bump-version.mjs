#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// File paths
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');
const PACKAGE_LOCK_PATH = path.join(PROJECT_ROOT, 'package-lock.json');
const METADATA_JSON_PATH = path.join(PROJECT_ROOT, 'metadata.json');
const VERSION_TS_PATH = path.join(PROJECT_ROOT, 'src', 'version.ts');

/**
 * Parse SemVer string into major, minor, patch integers.
 * @param {string} versionStr
 * @returns {{ major: number, minor: number, patch: number }}
 */
function parseSemVer(versionStr) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-.*)?$/.exec(versionStr.trim());
  if (!match) {
    throw new Error(`Invalid SemVer string: "${versionStr}"`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compute the next SemVer string based on bump type.
 * @param {string} currentVersion
 * @param {'major' | 'minor' | 'patch'} bumpType
 * @returns {string}
 */
function computeNextVersion(currentVersion, bumpType) {
  const { major, minor, patch } = parseSemVer(currentVersion);
  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Unknown bump type: ${bumpType}`);
  }
}

/**
 * Determine bump type from a commit message using Conventional Commits rules.
 * @param {string} message
 * @returns {'major' | 'minor' | 'patch'}
 */
function determineBumpTypeFromMessage(message) {
  const cleanMsg = (message || '').trim();
  if (!cleanMsg) {
    return 'patch';
  }

  // Check for Breaking Change
  // 1) "feat!:", "fix(api)!:" etc.
  const breakingHeaderRegex = /^[a-zA-Z]+(?:\([^)]+\))?!:\s*/m;
  // 2) "BREAKING CHANGE:" or "BREAKING-CHANGE:" in body/footer
  const breakingFooterRegex = /(?:^|\n)BREAKING[ -]CHANGE:\s*/;

  if (breakingHeaderRegex.test(cleanMsg) || breakingFooterRegex.test(cleanMsg)) {
    return 'major';
  }

  // Check for Minor (Feature)
  // "feat:", "feat(scope):"
  const featRegex = /^feat(?:\([^)]+\))?:\s*/m;
  if (featRegex.test(cleanMsg)) {
    return 'minor';
  }

  // Default for fix, perf, refactor, style, chore, docs, test, etc.
  return 'patch';
}

/**
 * Main execution routine.
 */
function main() {
  const args = process.argv.slice(2);
  let explicitType = null;
  let fromMsg = null;
  let fromMsgFile = null;
  let isAuto = false;
  let isDryRun = false;
  let shouldStage = false;

  for (const arg of args) {
    if (arg.startsWith('--type=')) {
      explicitType = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('--from-msg=')) {
      fromMsg = arg.slice('--from-msg='.length);
    } else if (arg.startsWith('--from-msg-file=')) {
      fromMsgFile = arg.slice('--from-msg-file='.length);
    } else if (arg === '--auto') {
      isAuto = true;
    } else if (arg === '--dry-run') {
      isDryRun = true;
    } else if (arg === '--stage') {
      shouldStage = true;
    }
  }

  // Read current version from package.json
  if (!fs.existsSync(PACKAGE_JSON_PATH)) {
    console.error(`Error: package.json not found at ${PACKAGE_JSON_PATH}`);
    process.exit(1);
  }

  const pkgRaw = fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8');
  const pkg = JSON.parse(pkgRaw);
  const currentVersion = pkg.version || '0.1.0';

  let bumpType = 'patch';

  if (explicitType && ['major', 'minor', 'patch'].includes(explicitType)) {
    bumpType = explicitType;
  } else if (fromMsgFile) {
    try {
      const msgContent = fs.readFileSync(fromMsgFile, 'utf-8');
      bumpType = determineBumpTypeFromMessage(msgContent);
    } catch (err) {
      console.warn(`Warning: Could not read message file ${fromMsgFile}, defaulting to patch.`, err);
      bumpType = 'patch';
    }
  } else if (fromMsg) {
    bumpType = determineBumpTypeFromMessage(fromMsg);
  } else if (isAuto) {
    try {
      const latestCommitMsg = execSync('git log -1 --pretty=%B', {
        cwd: PROJECT_ROOT,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      bumpType = determineBumpTypeFromMessage(latestCommitMsg);
    } catch {
      bumpType = 'patch';
    }
  }

  const nextVersion = computeNextVersion(currentVersion, bumpType);

  console.log(`[SemVer] Current: ${currentVersion} -> Next: ${nextVersion} (Bump: ${bumpType.toUpperCase()})`);

  if (isDryRun) {
    console.log('[SemVer] Dry-run enabled. No files written.');
    return;
  }

  const modifiedFiles = [];

  // 1. Update package.json
  pkg.version = nextVersion;
  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  modifiedFiles.push(PACKAGE_JSON_PATH);

  // 2. Update package-lock.json if present
  if (fs.existsSync(PACKAGE_LOCK_PATH)) {
    try {
      const lockRaw = fs.readFileSync(PACKAGE_LOCK_PATH, 'utf-8');
      const lock = JSON.parse(lockRaw);
      lock.version = nextVersion;
      if (lock.packages && lock.packages['']) {
        lock.packages[''].version = nextVersion;
      }
      fs.writeFileSync(PACKAGE_LOCK_PATH, JSON.stringify(lock, null, 2) + '\n', 'utf-8');
      modifiedFiles.push(PACKAGE_LOCK_PATH);
    } catch (err) {
      console.warn('Warning: Failed to update package-lock.json:', err.message);
    }
  }

  // 3. Update metadata.json if present
  if (fs.existsSync(METADATA_JSON_PATH)) {
    try {
      const metaRaw = fs.readFileSync(METADATA_JSON_PATH, 'utf-8');
      const meta = JSON.parse(metaRaw);
      meta.version = nextVersion;
      fs.writeFileSync(METADATA_JSON_PATH, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
      modifiedFiles.push(METADATA_JSON_PATH);
    } catch (err) {
      console.warn('Warning: Failed to update metadata.json:', err.message);
    }
  }

  // 4. Update or create src/version.ts
  const versionTsDir = path.dirname(VERSION_TS_PATH);
  if (!fs.existsSync(versionTsDir)) {
    fs.mkdirSync(versionTsDir, { recursive: true });
  }

  const buildTime = new Date().toISOString();
  const versionTsContent = `// This file is auto-generated by scripts/bump-version.mjs. Do not edit manually.
export const APP_VERSION = '${nextVersion}';
export const APP_BUILD_TIME = '${buildTime}';
`;
  fs.writeFileSync(VERSION_TS_PATH, versionTsContent, 'utf-8');
  modifiedFiles.push(VERSION_TS_PATH);

  console.log(`[SemVer] Successfully updated files to v${nextVersion}:`);
  modifiedFiles.forEach((f) => console.log(`  - ${path.relative(PROJECT_ROOT, f)}`));

  // 5. Stage modified files if requested or if inside Git hook
  if (shouldStage) {
    try {
      execSync('git add package.json package-lock.json metadata.json src/version.ts', {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
      });
      console.log('[SemVer] Staged updated version files in Git.');
    } catch (err) {
      console.warn('Warning: Failed to stage version files in Git:', err.message);
    }
  }
}

main();

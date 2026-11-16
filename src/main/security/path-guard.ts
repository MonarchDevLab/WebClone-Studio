import fs from 'node:fs';
import path from 'node:path';
import { APP_GENERATOR_SIGNATURE } from '../../shared/version';

const BLOCKED_SHELL_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.ps1',
  '.psm1',
  '.psd1',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.wsf',
  '.wsh',
  '.msi',
  '.msp',
  '.scr',
  '.com',
  '.pif',
  '.lnk',
  '.reg',
  '.dll',
  '.hta',
  '.cpl',
  '.jar',
]);

const ALLOWED_SAFE_OPEN_EXTENSIONS = new Set([
  '.html',
  '.htm',
  '.md',
  '.txt',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.svg',
  '.pdf',
  '.mhtml',
  '.wacz',
  '.css',
  '.ts',
  '.tsx',
  '.sqlite',
]);

async function resolveCanonicalWithExistingAncestor(targetPath: string): Promise<string> {
  const abs = path.resolve(targetPath);
  try {
    return await fs.promises.realpath(abs);
  } catch {
    // Walk upward until an existing ancestor directory can be canonicalized with realpath
    const segments: string[] = [];
    let cursor = abs;
    while (cursor !== path.dirname(cursor)) {
      if (fs.existsSync(cursor)) {
        const realBase = await fs.promises.realpath(cursor);
        return path.join(realBase, ...segments.reverse());
      }
      segments.push(path.basename(cursor));
      cursor = path.dirname(cursor);
    }
    return abs;
  }
}

/**
 * Ensures candidatePath resolves strictly inside rootDir (or equals rootDir when allowEqual is true),
 * resolving symlinks/junctions via realpath to block path traversal.
 */
export async function assertInsideRoot(
  rootDir: string,
  candidatePath: string,
  allowEqual: boolean = false
): Promise<string> {
  if (!rootDir || !candidatePath || candidatePath.includes('\0')) {
    throw new Error('ERR_PATH_TRAVERSAL: Invalid root or candidate path.');
  }

  const resolvedRoot = await resolveCanonicalWithExistingAncestor(rootDir);
  const resolvedCandidate = await resolveCanonicalWithExistingAncestor(candidatePath);

  const normRoot = process.platform === 'win32' ? resolvedRoot.toLowerCase() : resolvedRoot;
  const normCandidate = process.platform === 'win32' ? resolvedCandidate.toLowerCase() : resolvedCandidate;

  if (normCandidate === normRoot) {
    if (allowEqual) {
      return resolvedCandidate;
    }
    throw new Error('ERR_PATH_TRAVERSAL: Target cannot equal root directory.');
  }

  const rootWithSep = normRoot.endsWith(path.sep) ? normRoot : `${normRoot}${path.sep}`;
  if (!normCandidate.startsWith(rootWithSep)) {
    throw new Error(`ERR_PATH_TRAVERSAL: Path escapes root boundary (${candidatePath}).`);
  }

  return resolvedCandidate;
}

/**
 * Validates local files before passing to shell.openPath or shell.showItemInFolder.
 */
export async function assertSafeShellOpenFile(rawPath: string): Promise<string> {
  const trimmed = (rawPath || '').trim();
  if (!trimmed || trimmed.includes('\0')) {
    throw new Error('ERR_PATH_TRAVERSAL: Empty or malformed file path.');
  }
  if (/^(?:https?|javascript|data|file):/i.test(trimmed)) {
    throw new Error('ERR_PATH_TRAVERSAL: Remote or script URIs cannot be passed to local shell open.');
  }
  if (trimmed.startsWith('\\\\') || trimmed.startsWith('//')) {
    throw new Error('ERR_PATH_TRAVERSAL: UNC network paths are blocked.');
  }

  const realTarget = await fs.promises.realpath(path.resolve(trimmed));
  const stats = await fs.promises.stat(realTarget);
  if (!stats.isFile()) {
    throw new Error('ERR_PATH_TRAVERSAL: Target must be an existing regular file.');
  }

  const ext = path.extname(realTarget).toLowerCase();
  if (BLOCKED_SHELL_EXTENSIONS.has(ext) || !ALLOWED_SAFE_OPEN_EXTENSIONS.has(ext)) {
    throw new Error(`ERR_PATH_TRAVERSAL: File extension "${ext}" is blocked from shell execution.`);
  }

  return realTarget;
}

/**
 * Enforces strict triple-guard checks before deleting any project directory:
 * 1) Not filesystem drive root
 * 2) Not defaultOutputDir itself
 * 3) Must contain manifest.json with generator starting with "WebClone Studio"
 */
export async function assertDeletableProjectDir(
  projectPath: string,
  defaultOutputDir: string
): Promise<string> {
  if (!projectPath || projectPath.includes('\0')) {
    throw new Error('ERR_UNSAFE_PROJECT_DELETE: Invalid project path.');
  }

  const resolvedTarget = await resolveCanonicalWithExistingAncestor(projectPath);
  const resolvedDefault = defaultOutputDir
    ? await resolveCanonicalWithExistingAncestor(defaultOutputDir)
    : '';

  const targetRoot = path.parse(resolvedTarget).root;
  if (resolvedTarget === targetRoot) {
    throw new Error('ERR_UNSAFE_PROJECT_DELETE: Filesystem drive root cannot be deleted.');
  }

  const cmpTarget = process.platform === 'win32' ? resolvedTarget.toLowerCase() : resolvedTarget;
  const cmpDefault = process.platform === 'win32' ? resolvedDefault.toLowerCase() : resolvedDefault;

  if (cmpDefault && cmpTarget === cmpDefault) {
    throw new Error('ERR_UNSAFE_PROJECT_DELETE: Default WebClone output root directory cannot be deleted.');
  }

  const manifestPath = path.join(resolvedTarget, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('ERR_UNSAFE_PROJECT_DELETE: Missing manifest.json signature in target directory.');
  }

  try {
    const raw = await fs.promises.readFile(manifestPath, 'utf-8');
    const parsed = JSON.parse(raw) as { generator?: unknown };
    if (
      typeof parsed?.generator !== 'string' ||
      !parsed.generator.startsWith(APP_GENERATOR_SIGNATURE)
    ) {
      throw new Error('Invalid manifest generator signature.');
    }
  } catch (err: any) {
    throw new Error(`ERR_UNSAFE_PROJECT_DELETE: Invalid project manifest (${err?.message || err}).`);
  }

  return resolvedTarget;
}

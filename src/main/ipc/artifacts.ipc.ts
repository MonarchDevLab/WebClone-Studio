import fs from 'node:fs';
import path from 'node:path';
import { IpcChannel } from '../../shared/ipc-channels';
import { ArtifactReadResult, DiffSummary, ProjectArtifactSummary, ProjectManifest } from '../../shared/types';
import { WaczExporter } from '../generators/wacz-exporter';
import { handleSecure } from '../security/ipc-guard';
import { assertInsideRoot } from '../security/path-guard';
import { CrawlCheckpointDb } from '../storage/crawl-checkpoint-db';
import { IpcRuntimeContext } from './context';

const MAX_ARTIFACT_READ_BYTES = 512 * 1024;

function guessMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') return 'application/json';
  if (ext === '.tsx' || ext === '.ts') return 'text/typescript';
  if (ext === '.js' || ext === '.mjs') return 'text/javascript';
  if (ext === '.css') return 'text/css';
  if (ext === '.md') return 'text/markdown';
  if (ext === '.html' || ext === '.htm') return 'text/html';
  return 'text/plain';
}

async function listRelativeFilesRecursive(rootDir: string, currentDir: string, limit = 300): Promise<string[]> {
  if (!fs.existsSync(currentDir)) return [];
  const results: string[] = [];
  const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (results.length >= limit) break;
    const full = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await listRelativeFilesRecursive(rootDir, full, limit - results.length);
      results.push(...nested);
    } else if (entry.isFile()) {
      results.push(path.relative(rootDir, full).split(path.sep).join('/'));
    }
  }
  return results;
}

export function registerArtifactsIpc(_ctx: IpcRuntimeContext): void {
  handleSecure<string, ProjectArtifactSummary>(
    IpcChannel.ARTIFACTS_SUMMARY,
    async (_event, projectDir) => {
      const safeDir = await fs.promises.realpath(path.resolve(projectDir));
      const metaDir = path.join(safeDir, '_meta');
      const exportsDir = path.join(safeDir, '_exports');
      const componentsDir = path.join(safeDir, '_components');
      const sourceCodeDir = path.join(safeDir, 'site', '_source-code');

      let projectName = path.basename(safeDir);
      let sourceUrl = '';
      const manifestPath = path.join(safeDir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(
            await fs.promises.readFile(manifestPath, 'utf-8')
          ) as ProjectManifest;
          projectName = manifest.project?.name || projectName;
          sourceUrl = manifest.source?.url || '';
        } catch {}
      }

      let waczPath: string | undefined;
      if (fs.existsSync(exportsDir)) {
        const exportFiles = await fs.promises.readdir(exportsDir);
        const waczFile = exportFiles.find((f) => f.endsWith('.wacz'));
        if (waczFile) waczPath = path.posix.join('_exports', waczFile);
      }

      const standaloneCandidate = path.join(exportsDir, 'index.standalone.html');
      const mhtmlCandidate = path.join(exportsDir, 'index.mhtml');
      const systemMapCandidate = path.join(metaDir, 'SYSTEM_MAP.md');
      const tokensThemeCandidate = path.join(metaDir, 'tokens.theme.css');
      const extractedStateCandidate = path.join(metaDir, 'extracted-state.json');

      let openApiEndpointCount = 0;
      const openApiCandidate = path.join(metaDir, 'openapi.json');
      if (fs.existsSync(openApiCandidate)) {
        try {
          const parsed = JSON.parse(await fs.promises.readFile(openApiCandidate, 'utf-8'));
          openApiEndpointCount = Object.keys(parsed?.paths || {}).length;
        } catch {}
      }

      const exportedComponents = fs.existsSync(componentsDir)
        ? (await fs.promises.readdir(componentsDir))
            .filter((f) => f.endsWith('.tsx'))
            .map((f) => path.posix.join('_components', f))
        : [];

      const reconstructedSourceFiles = await listRelativeFilesRecursive(safeDir, sourceCodeDir, 300);

      let adaptiveEntityGroups = 0;
      const adaptiveCandidate = path.join(metaDir, 'adaptive-entities.json');
      if (fs.existsSync(adaptiveCandidate)) {
        try {
          const parsed = JSON.parse(await fs.promises.readFile(adaptiveCandidate, 'utf-8'));
          adaptiveEntityGroups = Object.keys(parsed || {}).length;
        } catch {}
      }

      let lastDiffSummary: DiffSummary | undefined;
      const diffCandidate = path.join(metaDir, 'diff-report.json');
      if (fs.existsSync(diffCandidate)) {
        try {
          lastDiffSummary = JSON.parse(
            await fs.promises.readFile(diffCandidate, 'utf-8')
          ) as DiffSummary;
        } catch {}
      }

      return {
        projectDir: safeDir,
        projectName,
        sourceUrl,
        hasWacz: Boolean(waczPath),
        waczPath,
        hasStandaloneHtml: fs.existsSync(standaloneCandidate),
        standalonePath: fs.existsSync(standaloneCandidate)
          ? '_exports/index.standalone.html'
          : undefined,
        hasMhtml: fs.existsSync(mhtmlCandidate),
        hasSystemMap: fs.existsSync(systemMapCandidate),
        canResume: CrawlCheckpointDb.hasIncompleteCheckpoint(safeDir),
        openApiEndpointCount,
        exportedComponents,
        reconstructedSourceFiles,
        adaptiveEntityGroups,
        hasDesignTokensTheme: fs.existsSync(tokensThemeCandidate),
        hasExtractedState: fs.existsSync(extractedStateCandidate),
        lastDiffSummary,
      };
    }
  );

  handleSecure<{ projectDir: string; relativePath: string }, ArtifactReadResult>(
    IpcChannel.ARTIFACTS_READ,
    async (_event, { projectDir, relativePath }) => {
      const safeProject = await fs.promises.realpath(path.resolve(projectDir));
      const cleanRel = (relativePath || '').replace(/^\/+/, '');
      const safeTarget = await assertInsideRoot(
        safeProject,
        path.resolve(safeProject, cleanRel),
        false
      );

      const stat = await fs.promises.stat(safeTarget);
      if (!stat.isFile()) {
        throw new Error('Requested artifact is not a regular file.');
      }

      const handle = await fs.promises.open(safeTarget, 'r');
      try {
        const readLen = Math.min(stat.size, MAX_ARTIFACT_READ_BYTES);
        const buf = Buffer.alloc(readLen);
        await handle.read(buf, 0, readLen, 0);
        return {
          content: buf.toString('utf-8'),
          mimeType: guessMimeType(safeTarget),
          truncated: stat.size > MAX_ARTIFACT_READ_BYTES,
          sizeBytes: stat.size,
        };
      } finally {
        await handle.close();
      }
    }
  );

  handleSecure<string, { filePath: string; sizeBytes: number; sha256: string }>(
    IpcChannel.EXPORT_WACZ,
    async (_event, projectDir) => {
      const safeProject = await fs.promises.realpath(path.resolve(projectDir));
      return WaczExporter.exportProject(safeProject);
    }
  );
}

import { SourceMapConsumer } from 'source-map';
import path from 'node:path';
import fs from 'node:fs';

function sanitizeSourcePath(rawSource: string): string {
  // Strip query string and fragment identifiers (?v=123, #hash) from Vite/Rollup virtual paths
  let cleanPath = rawSource.split('?')[0].split('#')[0];
  cleanPath = cleanPath.replace(/^([a-z][a-z0-9+.-]*):\/\/\/?/i, '$1/');
  cleanPath = cleanPath.replace(/^([a-zA-Z]:)?[/\\]+/, '');

  const segments = cleanPath
    .split(/[/\\]+/)
    .filter((seg) => seg && seg !== '.')
    .map((seg) => (seg === '..' ? '_up_' : seg.replace(/[<>:"|?*]/g, '_')));

  return segments.join('/');
}

/**
 * Asynchronously reconstructs original source files from a SourceMap v3 JSON payload.
 */
export async function reconstructSourceTree(mapContent: string, outputDir: string): Promise<void> {
  const mapData = JSON.parse(mapContent);
  if (!mapData.mappings) {
    mapData.mappings = '';
  }
  const consumer = await new SourceMapConsumer(mapData);

  try {
    const resolvedOutDir = path.resolve(outputDir);
    const outDirWithSep = resolvedOutDir.endsWith(path.sep) ? resolvedOutDir : resolvedOutDir + path.sep;

    for (const source of consumer.sources) {
      const content = consumer.sourceContentFor(source, true);
      if (!content) continue;

      const relativeClean = sanitizeSourcePath(source);
      if (!relativeClean) continue;

      const fullPath = path.resolve(resolvedOutDir, relativeClean);
      if (!fullPath.startsWith(outDirWithSep)) {
        continue;
      }

      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.promises.writeFile(fullPath, content, 'utf-8');
    }
  } finally {
    consumer.destroy();
  }
}

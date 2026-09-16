import { SourceMapConsumer } from 'source-map';
import path from 'path';
import fs from 'fs';

export async function reconstructSourceTree(mapContent: string, outputDir: string): Promise<void> {
  const mapData = JSON.parse(mapContent);
  if (!mapData.mappings) {
    mapData.mappings = '';
  }
  const consumer = await new SourceMapConsumer(mapData);

  try {
    const resolvedOutDir = path.resolve(outputDir);
    const outDirWithSep = resolvedOutDir.endsWith(path.sep) ? resolvedOutDir : resolvedOutDir + path.sep;

    consumer.sources.forEach((source) => {
      const content = consumer.sourceContentFor(source, true);
      if (content) {
        let cleanPath = source.replace(/^([a-z]+):\/\/\/?/, '$1/');
        // Strip leading slashes and Windows drive letters
        cleanPath = cleanPath.replace(/^([a-zA-Z]:)?[\/\\]+/, '');
        const fullPath = path.resolve(resolvedOutDir, cleanPath);

        if (!fullPath.startsWith(outDirWithSep)) {
          return;
        }

        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf-8');
      }
    });
  } finally {
    consumer.destroy();
  }
}

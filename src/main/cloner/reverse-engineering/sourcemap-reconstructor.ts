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
    consumer.sources.forEach((source) => {
      const content = consumer.sourceContentFor(source);
      if (content) {
        const cleanPath = source.replace(/^([a-z]+):\/\/\/?/, '$1/');
        const fullPath = path.resolve(resolvedOutDir, cleanPath);

        if (!fullPath.startsWith(resolvedOutDir)) {
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

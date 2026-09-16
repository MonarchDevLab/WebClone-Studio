import { expect, test } from 'vitest';
import { reconstructSourceTree } from '../../../../src/main/cloner/reverse-engineering/sourcemap-reconstructor';
import fs from 'fs';
import path from 'path';

test('reconstructSourceTree creates original files', async () => {
  const dummyMap = JSON.stringify({
    version: 3,
    sources: ['webpack:///src/app.tsx'],
    sourcesContent: ['export const App = () => <div>Hi</div>;']
  });
  const outDir = path.join(__dirname, 'test-out');
  await reconstructSourceTree(dummyMap, outDir);

  const content = fs.readFileSync(path.join(outDir, 'webpack', 'src', 'app.tsx'), 'utf-8');
  expect(content).toBe('export const App = () => <div>Hi</div>;');

  fs.rmSync(outDir, { recursive: true, force: true });
});

test('reconstructSourceTree handles multiple files and null sourcesContent', async () => {
  const dummyMap = JSON.stringify({
    version: 3,
    sources: ['webpack:///src/index.ts', 'webpack:///src/empty.ts'],
    sourcesContent: ['console.log("index");', null]
  });
  const outDir = path.join(__dirname, 'test-out-multiple');
  await reconstructSourceTree(dummyMap, outDir);

  const indexContent = fs.readFileSync(path.join(outDir, 'webpack', 'src', 'index.ts'), 'utf-8');
  expect(indexContent).toBe('console.log("index");');
  expect(fs.existsSync(path.join(outDir, 'webpack', 'src', 'empty.ts'))).toBe(false);

  fs.rmSync(outDir, { recursive: true, force: true });
});

test('reconstructSourceTree ignores path traversal attempts outside outputDir', async () => {
  const dummyMap = JSON.stringify({
    version: 3,
    sources: ['webpack:///../../traversal-test.js'],
    sourcesContent: ['malicious code']
  });
  const outDir = path.join(__dirname, 'test-out-traversal');
  await reconstructSourceTree(dummyMap, outDir);

  const outsideFile = path.resolve(outDir, '..', 'traversal-test.js');
  expect(fs.existsSync(outsideFile)).toBe(false);

  fs.rmSync(outDir, { recursive: true, force: true });
});

import { expect, test } from 'vitest';
import { reconstructSourceTree } from '../../../../src/main/cloner/reverse-engineering/sourcemap-reconstructor';
import fs from 'fs';
import path from 'path';

test('reconstructSourceTree creates original files', async () => {
  const outDir = path.join(__dirname, 'test-out');
  try {
    const dummyMap = JSON.stringify({
      version: 3,
      sources: ['webpack:///src/app.tsx'],
      sourcesContent: ['export const App = () => <div>Hi</div>;']
    });
    await reconstructSourceTree(dummyMap, outDir);

    const content = fs.readFileSync(path.join(outDir, 'webpack', 'src', 'app.tsx'), 'utf-8');
    expect(content).toBe('export const App = () => <div>Hi</div>;');
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('reconstructSourceTree handles multiple files and null sourcesContent', async () => {
  const outDir = path.join(__dirname, 'test-out-multiple');
  try {
    const dummyMap = JSON.stringify({
      version: 3,
      sources: ['webpack:///src/index.ts', 'webpack:///src/empty.ts'],
      sourcesContent: ['console.log("index");', null]
    });
    await reconstructSourceTree(dummyMap, outDir);

    const indexContent = fs.readFileSync(path.join(outDir, 'webpack', 'src', 'index.ts'), 'utf-8');
    expect(indexContent).toBe('console.log("index");');
    expect(fs.existsSync(path.join(outDir, 'webpack', 'src', 'empty.ts'))).toBe(false);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('reconstructSourceTree ignores path traversal attempts outside outputDir', async () => {
  const outDir = path.join(__dirname, 'test-out-traversal');
  try {
    const dummyMap = JSON.stringify({
      version: 3,
      sources: ['webpack:///../../traversal-test.js'],
      sourcesContent: ['malicious code']
    });
    await reconstructSourceTree(dummyMap, outDir);

    const outsideFile = path.resolve(outDir, '..', 'traversal-test.js');
    expect(fs.existsSync(outsideFile)).toBe(false);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('reconstructSourceTree ignores prefix bypass attempts', async () => {
  const outDir = path.join(__dirname, 'test-out-traversal');
  const hackedDir = path.join(__dirname, 'test-out-traversal-hacked');
  try {
    const dummyMap = JSON.stringify({
      version: 3,
      sources: ['../test-out-traversal-hacked/malicious.js'],
      sourcesContent: ['malicious code']
    });
    await reconstructSourceTree(dummyMap, outDir);

    expect(fs.existsSync(hackedDir)).toBe(false);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(hackedDir, { recursive: true, force: true });
  }
});

test('reconstructSourceTree handles absolute paths correctly', async () => {
  const outDir = path.join(__dirname, 'test-out-absolute');
  try {
    const dummyMap = JSON.stringify({
      version: 3,
      sources: ['/absolute/path/app.js', 'C:/project/src/index.js'],
      sourcesContent: ['console.log("absolute");', 'console.log("windows absolute");']
    });
    await reconstructSourceTree(dummyMap, outDir);

    const appJsContent = fs.readFileSync(path.join(outDir, 'absolute', 'path', 'app.js'), 'utf-8');
    expect(appJsContent).toBe('console.log("absolute");');

    const indexJsContent = fs.readFileSync(path.join(outDir, 'project', 'src', 'index.js'), 'utf-8');
    expect(indexJsContent).toBe('console.log("windows absolute");');
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('PageProcessor.extractSourceMapUrl extracts relative and inline source maps', async () => {
  const { PageProcessor } = await import('../../../../src/main/cloner/page-processor');
  
  const jsContent = 'function hello() { console.log("hi"); }\n//# sourceMappingURL=bundle.js.map';
  const resolved = PageProcessor.extractSourceMapUrl(jsContent, 'https://example.com/assets/js/bundle.js');
  expect(resolved).toBe('https://example.com/assets/js/bundle.js.map');

  const cssContent = '.test { color: red; } /*# sourceMappingURL=style.css.map */';
  const resolvedCss = PageProcessor.extractSourceMapUrl(cssContent, 'https://example.com/css/style.css');
  expect(resolvedCss).toBe('https://example.com/css/style.css.map');

  const dataUriJs = 'console.log("test");\n//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozfQ==';
  const resolvedData = PageProcessor.extractSourceMapUrl(dataUriJs, 'https://example.com/test.js');
  expect(resolvedData).toBe('data:application/json;base64,eyJ2ZXJzaW9uIjozfQ==');

  const noMapJs = 'console.log("no map");';
  expect(PageProcessor.extractSourceMapUrl(noMapJs, 'https://example.com/test.js')).toBeNull();
});

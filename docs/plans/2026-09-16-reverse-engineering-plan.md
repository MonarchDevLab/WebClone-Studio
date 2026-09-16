# Reverse Engineering Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the static cloner into a dynamic reverse engineering lab by recovering original source code via sourcemaps, extracting SPA state, intercepting API traffic, and recovering design tokens.

**Architecture:** We introduce an isolated layer `src/main/cloner/reverse-engineering/` containing 4 specialized extraction modules. These modules hook into the existing `PageProcessor` and `AssetDownloader` pipeline.

**Tech Stack:** Node.js, source-map, Cheerio, Electron WebContents

**Spec:** `docs/specs/2026-09-16-reverse-engineering-design.md`

## Global Constraints
- **Platform requirements:** Works securely offline on Windows.
- **Dependency limits:** Reuse existing `cheerio`, `got` where possible. Install `source-map`.
- No executing downloaded JS (`eval()`) in the main process.

---

### Task 1: Sourcemap Reconstructor

**Files:**
- Create: `src/main/cloner/reverse-engineering/sourcemap-reconstructor.ts`
- Create: `tests/main/cloner/reverse-engineering/sourcemap-reconstructor.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Raw `.map` file buffers.
- Produces: `async function reconstructSourceTree(mapContent: string, outputDir: string): Promise<void>`

- [ ] **Step 1: Install source-map dependency**

```bash
npm install source-map
npm install -D @types/source-map vitest
```

- [ ] **Step 2: Write the failing test**

Create `tests/main/cloner/reverse-engineering/sourcemap-reconstructor.test.ts`:
```typescript
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/main/cloner/reverse-engineering/sourcemap-reconstructor.test.ts`
Expected: FAIL with "module not found" or "reconstructSourceTree is not defined"

- [ ] **Step 4: Write minimal implementation**

Create `src/main/cloner/reverse-engineering/sourcemap-reconstructor.ts`:
```typescript
import { SourceMapConsumer } from 'source-map';
import path from 'path';
import fs from 'fs';

export async function reconstructSourceTree(mapContent: string, outputDir: string): Promise<void> {
  const mapData = JSON.parse(mapContent);
  const consumer = await new SourceMapConsumer(mapData);
  
  consumer.sources.forEach(source => {
    const content = consumer.sourceContentFor(source);
    if (content) {
      // Clean webpack:/// prefixes
      const cleanPath = source.replace(/^[a-z]+:\/\/\/?/, '');
      const fullPath = path.join(outputDir, cleanPath);
      
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf-8');
    }
  });
  
  consumer.destroy();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/main/cloner/reverse-engineering/sourcemap-reconstructor.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json src/main/cloner/reverse-engineering/sourcemap-reconstructor.ts tests/main/cloner/reverse-engineering/sourcemap-reconstructor.test.ts
git commit -m "feat(reverse-engineering): implement sourcemap reconstructor"
```

---

### Task 2: Framework Data Extractor

**Files:**
- Create: `src/main/cloner/reverse-engineering/framework-extractor.ts`
- Create: `tests/main/cloner/reverse-engineering/framework-extractor.test.ts`

**Interfaces:**
- Consumes: HTML string
- Produces: `function extractFrameworkState(html: string): Record<string, any>`

- [ ] **Step 1: Write the failing test**

Create `tests/main/cloner/reverse-engineering/framework-extractor.test.ts`:
```typescript
import { expect, test } from 'vitest';
import { extractFrameworkState } from '../../../../src/main/cloner/reverse-engineering/framework-extractor';

test('extracts NEXT_DATA from html', () => {
  const html = `<html><body><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"title":"Test"}}}</script></body></html>`;
  const result = extractFrameworkState(html);
  expect(result.nextData.props.pageProps.title).toBe('Test');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/cloner/reverse-engineering/framework-extractor.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Create `src/main/cloner/reverse-engineering/framework-extractor.ts`:
```typescript
import * as cheerio from 'cheerio';

export function extractFrameworkState(html: string): Record<string, any> {
  const $ = cheerio.load(html);
  const state: Record<string, any> = {};

  const nextData = $('#__NEXT_DATA__').html();
  if (nextData) {
    try { state.nextData = JSON.parse(nextData); } catch (e) {}
  }
  
  const nuxtData = $('#__NUXT_DATA__').html() || $('#__NUXT__').html();
  if (nuxtData) {
    try { state.nuxtData = JSON.parse(nuxtData); } catch (e) {}
  }

  return state;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/cloner/reverse-engineering/framework-extractor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/cloner/reverse-engineering/framework-extractor.ts tests/main/cloner/reverse-engineering/framework-extractor.test.ts
git commit -m "feat(reverse-engineering): implement SPA framework data extractor"
```

---

### Task 3: Setup UI Controls

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/renderer/src/stores/clone-store.ts`

**Interfaces:**
- Consumes: Existing Settings interfaces
- Produces: `reverseEngineering: boolean` in Settings

- [ ] **Step 1: Add type definition**

Modify `src/shared/types.ts` to add `reverseEngineering: boolean` to `CloneSettings` interface:
```typescript
export interface CloneSettings {
  // ... existing fields ...
  reverseEngineering: boolean;
}
```

- [ ] **Step 2: Add to store defaults**

Modify `src/renderer/src/stores/clone-store.ts` to include `reverseEngineering: true` in `settings`:
```typescript
  settings: {
    // ... existing ...
    reverseEngineering: true,
  },
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts src/renderer/src/stores/clone-store.ts
git commit -m "feat(ui): add reverse engineering setting flag"
```

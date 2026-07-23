import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Guard test: none of the four banned fabricated/over-claiming strings from the
 * pre-remediation UI may reappear anywhere in src/. This is the regression test
 * for the truth-in-UI phase — it must fail loudly if any of these creep back in.
 */
const BANNED_STRINGS = [
  '% Match Confidence',
  'Anti-Hallucination',
  'Verified Sources',
  'agent is crawling',
];

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'test') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('no fabricated medical-grade claims remain in src/', () => {
  const files = collectSourceFiles(join(__dirname, '..'));

  it.each(BANNED_STRINGS)('banned string "%s" does not appear in any source file', (banned) => {
    const offenders = files.filter((f) => readFileSync(f, 'utf-8').includes(banned));
    expect(offenders).toEqual([]);
  });
});

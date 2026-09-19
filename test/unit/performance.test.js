import { marked } from '../../lib/marked.esm.js';
import { describe, it } from 'node:test';
import assert from 'node:assert';

/**
 * Performance regression tests.
 *
 * These assert growth *trends* across input scales, never absolute times, so
 * they do not depend on the speed of the machine running them: a linear
 * parser doubles its time when the input doubles, a quadratic one quadruples
 * it. The threshold of 3 sits halfway between the two.
 */

function timeParse(markdown, runs = 3) {
  // best-of-N: the fastest run is the least polluted by JIT, GC and
  // scheduling noise
  let best = Infinity;
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    marked.parse(markdown);
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

function assertNearLinearGrowth(name, makeInput, size) {
  // warm up JIT and lazy regex compilation on both scales
  marked.parse(makeInput(16));
  marked.parse(makeInput(32));

  const small = timeParse(makeInput(size));
  const large = timeParse(makeInput(size * 2));
  const growth = large / small;
  assert.ok(
    growth < 3,
    `${name}: parse time grew ${growth.toFixed(2)}x when input size doubled `
    + `(${small.toFixed(1)}ms -> ${large.toFixed(1)}ms); `
    + 'expected near-linear growth below 3x, quadratic growth would be ~4x',
  );
}

describe('performance', () => {
  describe('reflinkSearch', () => {
    // Regression: reflinkSearch is unanchored and runs with the global flag,
    // so every '[' in the source is a start position. A candidate that can
    // never match still scanned to the end of the source, making inputs dense
    // in escaped brackets cost O(n^2).
    it('scales near-linearly on escaped open brackets', () => {
      assertNearLinearGrowth('escaped open brackets', n => '\\['.repeat(n), 16000);
    });

    it('scales near-linearly on escaped bracket pairs', () => {
      assertNearLinearGrowth('escaped bracket pairs', n => '\\[\\]'.repeat(n), 16000);
    });
  });
});

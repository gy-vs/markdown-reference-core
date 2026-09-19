import { parse } from '../../lib/marked.esm.js';
import { describe, it } from 'node:test';
import assert from 'node:assert';

// `reflinkSearch` scans the source with a global regex, so every '[' used to
// restart a scan that could run to the end of the source: O(n^2) on inputs
// full of escaped brackets. The redos specs bound these shapes to one second,
// but an absolute limit only says the parse was fast on the machine that ran
// it. These tests instead compare how the parse time grows with the input
// size: near-linear growth roughly follows the scale factor, while the old
// quadratic scan follows its square.
const scale = 4;
const base = 8000;
// Near-linear growth stays within a small multiple of the scale factor; the
// quadratic scan grew with its square (16x for a 4x input).
const maxGrowth = scale * 2;

const shapes = {
  'escaped open brackets': n => '[' + '\t\\['.repeat(n) + '[',
  'escaped bracket pairs': n => '[' + '\t\\[\\]'.repeat(n) + '[',
};

function fastestParse(markdown, runs = 3) {
  let fastest = Infinity;
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    parse(markdown);
    fastest = Math.min(fastest, performance.now() - start);
  }
  return fastest;
}

describe('reflinkSearch performance', () => {
  for (const [name, shape] of Object.entries(shapes)) {
    it(`${name} grow near-linearly`, () => {
      const small = shape(base);
      const large = shape(base * scale);
      fastestParse(small, 1); // warm up the JIT
      const smallTime = fastestParse(small);
      const largeTime = fastestParse(large);
      assert.ok(
        largeTime < smallTime * maxGrowth,
        `parse time grew ${(largeTime / smallTime).toFixed(1)}x for a ${scale}x input`
        + ` (${smallTime.toFixed(1)}ms -> ${largeTime.toFixed(1)}ms);`
        + ` near-linear growth should stay under ${maxGrowth}x`,
      );
    });
  }
});

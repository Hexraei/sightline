// Self-check for the gap-fitter: node tools/fit.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseVtt, computeGaps, fitLine } from '../public/fit.js';

const cues = parseVtt(readFileSync(new URL('../public/assets/sample-scene.vtt', import.meta.url), 'utf8'));
assert.equal(cues.length, 16);
assert.deepEqual(cues[0], { t0: 2, t1: 6.1, text: "JOHNNY: They ought to make the day the time changes the first day of summer." });
assert.equal(cues[3].t1, 67);

const gaps = computeGaps(cues, 400);
assert.deepEqual(gaps[0], { t0: 6.1, t1: 28 });          // lead-in of 2s is under EDGE_MIN, so skipped
assert.ok(!gaps.some(g => g.t0 === 35));                  // back-to-back cues leave no gap
assert.ok(!gaps.some(g => g.t0 === 124));                 // 0.1s gap is below the pad
assert.deepEqual(gaps.at(-1), { t0: 179, t1: 400 });      // tail silence
assert.deepEqual(computeGaps([], 10), [{ t0: 0, t1: 10 }]);
assert.deepEqual(computeGaps([{ t0: 5, t1: 8 }], 9), [{ t0: 0, t1: 5 }]);

// Hours optional, SRT commas, tags stripped, overlap extends dialogue.
const odd = parseVtt('1\n00:01,000 --> 00:03,000\n<i>Hi</i>\n\n00:02.000 --> 00:05.000\nThere\n\n00:06.000 --> 00:07.000\nYo');
assert.equal(odd[0].text, 'Hi');
assert.deepEqual(computeGaps(odd, 7), [{ t0: 5, t1: 6 }]);

const v = { full: 'x'.repeat(60), tight: 'x'.repeat(30), glimpse: 'x'.repeat(15) };
assert.equal(fitLine(v, { t0: 0, t1: 4.4 }).variant, 'full');     // 60/15 = 4.0s == 4.4 - 0.4
assert.equal(fitLine(v, { t0: 0, t1: 4.39 }).variant, 'tight');
assert.equal(fitLine(v, { t0: 0, t1: 1.4 }).variant, 'glimpse');
assert.equal(fitLine(v, { t0: 0, t1: 1.3 }), null);
assert.equal(fitLine({ full: '', tight: 'abc' }, { t0: 0, t1: 9 }).variant, 'tight');
console.log('fit: ok');

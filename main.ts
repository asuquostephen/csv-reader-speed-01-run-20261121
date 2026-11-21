// The harness driver for the csv-reader-speed-01 entry: node runs
// `node /bot/main.ts` (Node 22). It reads every case from
// /input/cases.json (a JSON array of {id, input}), answers each case
// alone with run() from solve.js, and writes /output/answers.json: a
// JSON array of the answers, one per case and in the cases' order.
// Outside a container, MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR stand
// in for /input and /output.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// V8's incremental marking off, set before solve.js is imported so all
// of its work runs under it (the house baseline runs the same way, and
// the rules allow an entry to tune V8's flags the same way).
setFlagsFromString('--no-incremental-marking');

/** solve.js, imported by its URL (a .js module carries no types). */
const { run } = (await import(new URL('./solve.js', import.meta.url).href)) as {
  run: (input: unknown) => unknown;
};

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Answers every case in order; each case is answered alone. */
function answerAll(cases: { id: string; input: unknown }[]): unknown[] {
  const answers: unknown[] = [];
  for (const c of cases) answers.push(run(c.input));
  return answers;
}

const cases = JSON.parse(
  readFileSync(join(inputDir, 'cases.json'), 'utf8'),
) as { id: string; input: unknown }[];

writeFileSync(join(outputDir, 'answers.json'), JSON.stringify(answerAll(cases)));

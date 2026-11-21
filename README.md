# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/asuquostephen/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/asuquostephen/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0, built by an AI agent
for the make.fun bounty
[csv-reader-speed-01-run-20261121](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
("Read broken CSV files faster, 21 November 2026", $100 in USDC).

`solve.js` exports `run(input)`, which returns exactly the answer
csv-reader 1.0.0 returns for every input `{text, header}` — the value
`{columns, rows, errors}` under csv-reader's broken-row policy (stray CRs
dropped, unterminated quotes read again as unquoted text, junk after a
closing quote appended, short rows padded, long rows cut, every breakage
recorded as an error with its record's line and row). `main.ts` is the
harness driver: it reads every case from `/input/cases.json`, answers each
with `run`, and writes `/output/answers.json`.

Where the reference builds every field a character at a time, this reader
walks the text once and slices each field out of it whole: an unquoted
field is a tight `charCodeAt` scan between slice points, a quoted field is
found with `indexOf` and sliced when its content needs no edits, and the
field just read is passed back in shared slots rather than a fresh array.
On the kit's practice set it answers all 6 cases identically to the
reference in about a quarter of the reference's CPU time.

## Layout

- `solve.js` — the reader (dependency-free ES module, Node 22).
- `main.ts` — the driver the harness runs (`node /bot/main.ts`); it turns
  V8's incremental marking off before importing `solve.js`, as the house
  baseline does.
- `package.json` — `{"type": "module"}` so `solve.js` loads as an ES
  module.

MIT licensed — see `LICENSE`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseCsv, monthlyHours, effort, score, rank, summarize, report } from '../src/audit.mjs';

const HEAD = 'task,owner,runs_per_month,minutes_per_run,error_rate_pct,complexity,data_structured\n';
const sample = () => parseCsv(readFileSync(new URL('../examples/sample-inventory.csv', import.meta.url), 'utf8'));

test('parses the sample file and skips comment lines', () => {
  const rows = sample();
  assert.equal(rows.length, 12);
  assert.equal(rows[0].owner, 'Finance');
});

test('handles quoted commas', () => {
  const [r] = parseCsv(HEAD + '"Send, then log",Ops,10,6,0,1,yes\n');
  assert.equal(r.task, 'Send, then log');
});

test('monthly hours: base time plus rework at 3x per error', () => {
  const t = { runs: 60, minutes: 10, errorPct: 10 };
  // base 10h; rework 6 errors * 30min = 3h
  assert.equal(monthlyHours(t), 13);
});

test('effort adds a penalty for unstructured data', () => {
  assert.equal(effort({ complexity: 2, data: 'yes' }), 2);
  assert.equal(effort({ complexity: 2, data: 'partly' }), 3);
  assert.equal(effort({ complexity: 2, data: 'no' }), 5);
});

test('score computes payoff as hours over effort', () => {
  const s = score({ task: 'x', owner: 'o', runs: 60, minutes: 10, errorPct: 10, complexity: 2, data: 'yes' });
  assert.equal(s.hours, 13);
  assert.equal(s.payoff, 6.5);
});

test('rank sorts by payoff, highest first, ties by name', () => {
  const ranked = rank(sample());
  for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].payoff >= ranked[i].payoff);
  const tie = rank(parseCsv(HEAD + 'B,o,10,6,0,1,yes\nA,o,10,6,0,1,yes\n'));
  assert.deepEqual(tie.map((r) => r.task), ['A', 'B']);
});

test('sample ranking is stable: top task and top-3 share', () => {
  const ranked = rank(sample());
  assert.equal(ranked[0].task, 'Update CRM after sales calls');
  const s = summarize(ranked, 3);
  assert.equal(s.total, 243.9);
  assert.equal(s.topShare, 35);
});

test('rejects missing columns, bad numbers and bad data flag', () => {
  assert.throws(() => parseCsv('task,owner\nx,y\n'), /missing columns/);
  assert.throws(() => parseCsv(HEAD + 'x,o,abc,5,1,2,yes\n'), /bad runs_per_month/);
  assert.throws(() => parseCsv(HEAD + 'x,o,5,5,150,2,yes\n'), /bad error_rate_pct/);
  assert.throws(() => parseCsv(HEAD + 'x,o,5,5,1,9,yes\n'), /bad complexity/);
  assert.throws(() => parseCsv(HEAD + 'x,o,5,5,1,2,maybe\n'), /data_structured/);
  assert.throws(() => parseCsv(''), /empty/);
});

test('report lists every task and flags unstructured data', () => {
  const out = report(rank(sample()));
  assert.match(out, /# Automation audit/);
  assert.equal((out.match(/^\| \d+ \|/gm) || []).length, 12);
  assert.match(out, /Fix the data first for:/);
});

test('cli runs on the sample and fails cleanly without args', () => {
  const cli = new URL('../src/cli.mjs', import.meta.url).pathname;
  const ok = execFileSync('node', [cli, new URL('../examples/sample-inventory.csv', import.meta.url).pathname]).toString();
  assert.match(ok, /Start with:/);
  assert.throws(() => execFileSync('node', [cli], { stdio: 'pipe' }));
});

test('sample: a big time sink with unstructured data ranks below small structured wins', () => {
  const ranked = rank(sample());
  const triage = ranked.findIndex((r) => r.task.startsWith('Triage shared support'));
  assert.equal(triage, 6);
  assert.equal(ranked[triage].hours, 37.2);
});

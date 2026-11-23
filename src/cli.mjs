#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseCsv, rank, report } from './audit.mjs';

const [file, topArg] = process.argv.slice(2);
if (!file) {
  console.error('usage: automation-audit <inventory.csv> [top-n]');
  process.exit(2);
}
try {
  process.stdout.write(report(rank(parseCsv(readFileSync(file, 'utf8'))), Number(topArg) || 3));
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exit(1);
}

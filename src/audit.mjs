// Core logic: parse a workflow inventory CSV and rank tasks by automation payoff.
export const REQUIRED = ['task', 'owner', 'runs_per_month', 'minutes_per_run', 'error_rate_pct', 'complexity', 'data_structured'];

export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (!lines.length) throw new Error('empty inventory');
  const split = (l) => {
    const out = []; let cur = ''; let q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const header = split(lines[0]);
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) throw new Error(`missing columns: ${missing.join(', ')}`);
  return lines.slice(1).map((l, i) => {
    const cells = split(l);
    const row = Object.fromEntries(header.map((h, j) => [h, cells[j] ?? '']));
    return normalize(row, i + 2);
  });
}

function num(v, name, line, { min = 0, max = Infinity } = {}) {
  const n = Number(v);
  if (v === '' || Number.isNaN(n) || n < min || n > max) throw new Error(`line ${line}: bad ${name} "${v}"`);
  return n;
}

function normalize(r, line) {
  const complexity = num(r.complexity, 'complexity', line, { min: 1, max: 5 });
  const data = String(r.data_structured).toLowerCase();
  if (!['yes', 'partly', 'no'].includes(data)) throw new Error(`line ${line}: data_structured must be yes/partly/no`);
  return {
    task: r.task,
    owner: r.owner,
    runs: num(r.runs_per_month, 'runs_per_month', line),
    minutes: num(r.minutes_per_run, 'minutes_per_run', line),
    errorPct: num(r.error_rate_pct, 'error_rate_pct', line, { max: 100 }),
    complexity,
    data,
  };
}

// Hours a person spends per month, plus rework time for errors (each error costs 3x a run).
export function monthlyHours(t) {
  const base = (t.runs * t.minutes) / 60;
  const rework = ((t.runs * t.errorPct) / 100) * ((t.minutes * 3) / 60);
  return base + rework;
}

// Effort is a rough 1..~8 number: complexity, plus a penalty when the data is not structured.
export function effort(t) {
  return t.complexity + { yes: 0, partly: 1, no: 3 }[t.data];
}

export function score(t) {
  const hours = monthlyHours(t);
  return { ...t, hours: round(hours), effort: effort(t), payoff: round(hours / effort(t)) };
}

export function rank(rows) {
  return rows.map(score).sort((a, b) => b.payoff - a.payoff || a.task.localeCompare(b.task));
}

export function summarize(ranked, top = 3) {
  const total = ranked.reduce((s, r) => s + r.hours, 0);
  const topRows = ranked.slice(0, top);
  const topHours = topRows.reduce((s, r) => s + r.hours, 0);
  return { total: round(total), topHours: round(topHours), topShare: total ? Math.round((topHours / total) * 100) : 0, top: topRows };
}

export function report(ranked, top = 3) {
  const s = summarize(ranked, top);
  const lines = ['# Automation audit', '', '| # | Task | Owner | Hours/month | Effort | Payoff |', '|---|------|-------|-------------|--------|--------|'];
  ranked.forEach((r, i) => lines.push(`| ${i + 1} | ${r.task} | ${r.owner} | ${r.hours} | ${r.effort} | ${r.payoff} |`));
  lines.push('', `Total manual time: ${s.total} h/month across ${ranked.length} tasks.`);
  lines.push(`Start with: ${s.top.map((r) => r.task).join('; ')} (${s.topHours} h/month, ${s.topShare}% of the total).`);
  const hard = ranked.filter((r) => r.data === 'no');
  if (hard.length) lines.push(`Fix the data first for: ${hard.map((r) => r.task).join('; ')} (data is not structured).`);
  return lines.join('\n') + '\n';
}

function round(n) { return Math.round(n * 10) / 10; }

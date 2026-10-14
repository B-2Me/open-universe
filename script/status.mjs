#!/usr/bin/env node
/*
 * status.mjs — read-only dashboard for a running (or finished) sweep.
 *
 *   node script/status.mjs [--config=config/full-sweep.json]
 *                          [--out=knot_dictionary.json]
 *                          [--watch=30]   (re-render every N sec)
 *
 * Reads the sweep config to know the candidate universe, merges it
 * with knot_dictionary.json for completed measurements, and reads
 * logs/status.json for the live mid-candidate heartbeat. Prints a
 * progress bar, yield rate, latest stable discovery, and an ETA from
 * measured per-candidate wall time.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const arg = (k, d) => {
  const m = process.argv.find(a => a === `--${k}` || a.startsWith(`--${k}=`));
  return m ? (m.includes('=') ? m.split('=')[1] : true) : d;
};

const CFG_PATH = resolve(ROOT, String(arg('config', 'config/full-sweep.json')));
const OUT = resolve(ROOT, String(arg('out', 'knot_dictionary.json')));
const WATCH = parseInt(arg('watch', '0'));
const SHOW_ALL = !!arg('all', false);
const FRESH_MS = 600000; // heartbeats older than this collapse/hide
const tickRate = {};     // scenario → {t, ts} — ETA from watch-mode deltas

const fmtDur = (ms) => {
  if (!isFinite(ms) || ms < 0) return '?';
  const s = Math.round(ms / 1000);
  return s >= 3600 ? `${(s / 3600).toFixed(1)}h` : s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`;
};
const fmtMs = (ms) => fmtDur(ms);

function render() {
  const _lines = [];
  const console = { log: (s = '') => _lines.push(String(s)) };

  // ---- candidate universe from the sweep config ----
  let cfg = {}, candNames = [];
  try { cfg = JSON.parse(readFileSync(CFG_PATH, 'utf8')); }
  catch { console.log(`no sweep config at ${CFG_PATH}`); }
  const seedsDir = resolve(ROOT, cfg.seeds || 'seeds');
  try {
    const all = statSync(seedsDir).isDirectory()
      ? readdirSync(seedsDir).filter(f => f.startsWith('hopfion') && f.endsWith('.json')).map(f => basename(f, '.json'))
      : [basename(seedsDir, '.json')];
    const only = cfg.only ? String(cfg.only).split(',') : null;
    candNames = only ? all.filter(n => only.includes(n)) : all;
  } catch { /* dir may not exist yet */ }

  // ---- completed measurements ----
  const dict = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { entries: [] };
  const ticks = cfg.ticks ?? dict.ticks ?? 400;
  const diss = cfg.diss ?? dict.diss, limit = cfg.limit ?? dict.limit, mode = cfg.mode ?? dict.mode ?? 0;
  const sigOf = (e) => e.sig || `${e.name}|${e.dims?.join('x')}|t${ticks}|d${diss}|l${limit}|m${mode}`;
  const entries = dict.entries || [];
  const doneNames = new Set(entries.filter(e => candNames.length === 0 || candNames.includes(e.name)).map(e => e.name));
  const done = candNames.length ? entries.filter(e => doneNames.has(e.name)) : entries;
  const total = candNames.length || entries.length;
  const stable = done.filter(e => e.verdict === 'stable');
  const failed = done.filter(e => e.verdict !== 'stable');

  // ---- live heartbeat ----
  let live = null;
  const hbPath = join(ROOT, 'logs', 'status.json');
  try { live = JSON.parse(readFileSync(hbPath, 'utf8')); } catch {}
  const liveAge = live ? Date.now() - live.ts : Infinity;
  const isAlive = live && liveAge < 120000; // heartbeat fresher than 2min

  // ---- render ----
  const pct = total ? Math.round(100 * done.length / total) : 0;
  const barW = 28, fill = Math.round(barW * done.length / Math.max(1, total));
  console.log('\n  KNOT DICTIONARY SWEEP');
  console.log(`  [${'█'.repeat(fill)}${'░'.repeat(barW - fill)}] ${pct}% (${done.length}/${total} candidates)`);

  const yieldPct = done.length ? Math.round(100 * stable.length / done.length) : 0;
  console.log(`  yield: ${stable.length} stable / ${failed.length} unraveled (${yieldPct}% of evaluated)`);

  const latest = stable.length ? stable[stable.length - 1] : done[done.length - 1];
  if (latest) console.log(`  latest: ${latest.name} — mass ${latest.massEnd?.toLocaleString()}q, ` +
    `r=(${latest.radiusXY},${latest.radiusZ}), ${latest.verdict}, ${latest.loops} loops`);

  if (live && (isAlive || SHOW_ALL)) {
    if (live.phase === 'ticking') {
      const tPct = Math.round(100 * live.t / (live.config?.ticks || ticks));
      const tele = live.q != null ? ` q=${(live.q / 1e6).toFixed(2)}M dead=${live.dead}` : '';
      console.log(`  live:   ${live.candidate} ticking ${live.t}/${live.config?.ticks || ticks} (${tPct}%)${tele}${isAlive ? '' : ' [STALE heartbeat]'}`);
    } else if (live.candidate) {
      console.log(`  live:   ${live.candidate} — ${live.phase}${isAlive ? '' : ' [STALE heartbeat]'}`);
    }
  }

  // ETA: mean measured ms per candidate from the dictionary
  const timed = done.filter(e => e.ms > 0);
  if (timed.length && done.length < total) {
    const avg = timed.reduce((a, e) => a + e.ms, 0) / timed.length;
    const rem = total - done.length;
    console.log(`  pace:   ${fmtMs(avg)}/candidate · ~${fmtDur(avg * rem)} remaining (${rem} left)`);
  }
  if (live?.started && done.length < total)
    console.log(`  uptime: ${fmtDur(Date.now() - live.started)} since launch`);

  // ---- orchestration queue — stage heartbeat from logs/queue-status.json ----
  let queue = null;
  try { queue = JSON.parse(readFileSync(join(ROOT, 'logs', 'queue-status.json'), 'utf8')); } catch {}
  if (queue) {
    const qAge = Date.now() - queue.ts;
    const qFill = Math.round(28 * queue.idx / Math.max(1, queue.total));
    console.log('  JOB QUEUE');
    console.log(`  [${'█'.repeat(qFill)}${'░'.repeat(28 - qFill)}] ${queue.idx}/${queue.total} — stage: ${queue.stage}` +
      ` (${queue.stages.join(' → ')})${qAge < 120000 ? '' : ' [STALE]'}`);
  }

  // ---- boost basin (Phase 5) — separate heartbeat, same pattern ----
  let boost = null;
  try { boost = JSON.parse(readFileSync(join(ROOT, 'logs', 'boost-status.json'), 'utf8')); } catch {}
  if (boost) {
    const bAge = Date.now() - boost.ts;
    const bAlive = bAge < 120000;
    if (bAge < FRESH_MS || SHOW_ALL) {
    console.log('  BOOST BASIN');
    console.log(`  run:    ${boost.seed} vector ${boost.vector} dir (${boost.dir}) · ${boost.ticks} ticks`);
    if (boost.phase === 'ticking') {
      const bPct = Math.round(100 * boost.t / boost.ticks);
      console.log(`  live:   tick ${boost.t}/${boost.ticks} (${bPct}%) knot=(${boost.kx},${boost.ky},${boost.kz}) ` +
        `knotRetain=${boost.knotRetain} coherence=${boost.coherence}${bAlive ? '' : ' [STALE heartbeat]'}`);
    } else {
      console.log(`  state:  ${boost.phase}${boost.verdict ? ' — ' + boost.verdict : ''}${bAlive ? '' : ' [STALE heartbeat]'}`);
    }
    console.log(`  age:    heartbeat ${fmtDur(bAge)} ago`);
    }
  }

  // ---- collision matrix (Phase 6) — scenario progress + heartbeat ----
  let col = null;
  try { col = JSON.parse(readFileSync(join(ROOT, 'logs', 'collide-status.json'), 'utf8')); } catch {}
  let colCfg = { scenarios: [] }, colRes = [];
  // Resolve the active config: explicit flag > heartbeat's own config
  // field > whichever config/collide-*.json contains the live scenario
  // > matrix default.
  const colCfgPaths = [String(arg('collide-config', ''))].filter(Boolean);
  if (col?.config) colCfgPaths.push(col.config);
  let collFiles = [];
  try { collFiles = readdirSync(resolve(ROOT, 'config')).filter(f => f.startsWith('collide-') && f.endsWith('.json')); } catch {}
  for (const f of collFiles) {
    try {
      const c = JSON.parse(readFileSync(resolve(ROOT, 'config', f), 'utf8'));
      if (col?.scenario && (c.scenarios ?? []).some(s => s.name === col.scenario)) colCfgPaths.push(`config/${f}`);
    } catch {}
  }
  colCfgPaths.push('config/collide-matrix.json');
  for (const p of colCfgPaths) {
    try { colCfg = JSON.parse(readFileSync(resolve(ROOT, p), 'utf8')); break; } catch {}
  }
  try { colRes = JSON.parse(readFileSync(join(ROOT, 'logs', 'collide-results.json'), 'utf8')); } catch {}
  const colNames = new Set((colCfg.scenarios ?? []).map(s => s.name));
  const colTotal = colNames.size;
  if (col || colTotal) {
    const cAge = col ? Date.now() - col.ts : Infinity;
    const cAlive = cAge < 120000;
    const colDoneRes = colRes.filter(r => colNames.size === 0 || colNames.has(r.name));
    // Intra-scenario progress: a ticking scenario contributes its tick
    // fraction; total ticks from scenario override or config duration_ticks.
    let frac = 0, liveTotal = 0;
    if (col?.phase === 'ticking' && col.t != null && (colNames.size === 0 || colNames.has(col.scenario))) {
      const sc = (colCfg.scenarios ?? []).find(s => s.name === col.scenario);
      liveTotal = sc?.ticks ?? colCfg.duration_ticks ?? 1000;
      frac = Math.min(1, col.t / liveTotal);
    }
    const colProg = Math.min(colTotal, colDoneRes.length + frac);
    const cFill = Math.round(28 * colProg / Math.max(1, colTotal));
    const verdicts = {};
    for (const r of colDoneRes) verdicts[r.verdict] = (verdicts[r.verdict] ?? 0) + 1;
    console.log('  COLLISION MATRIX');
    console.log(`  [${'█'.repeat(cFill)}${'░'.repeat(28 - cFill)}] ${colProg.toFixed(1)}/${colTotal} scenarios` +
      (colDoneRes.length ? ` — ${Object.entries(verdicts).map(([k, v]) => `${v} ${k}`).join(', ')}` : ''));
    if (col && (cAge < FRESH_MS || SHOW_ALL)) {
      if (col.phase === 'ticking') {
        // ETA from observed tick rate between watch renders (prevTick is
        // module state; first render has no rate yet).
        let eta = '';
        const prev = tickRate[col.scenario];
        if (prev && col.t > prev.t) {
          const msPerTick = (col.ts - prev.ts) / (col.t - prev.t);
          if (liveTotal) eta = ` · ~${fmtDur(msPerTick * (liveTotal - col.t))} left`;
        }
        tickRate[col.scenario] = { t: col.t, ts: col.ts };
        const tPct = liveTotal ? ` ${Math.round(100 * col.t / liveTotal)}%` : '';
        console.log(`  live:   ${col.scenario} tick ${col.t}/${liveTotal || '?'}${tPct} gap=${col.gap ?? '—'} merged=${col.merged}${eta}${cAlive ? '' : ' [STALE heartbeat]'}`);
      } else {
        console.log(`  state:  ${col.scenario} — ${col.phase}${col.verdict ? ': ' + col.verdict : ''}${cAlive ? '' : ' [STALE heartbeat]'}`);
      }
      console.log(`  age:    heartbeat ${fmtDur(cAge)} ago`);
    }
  }

  // ---- other experiment heartbeats (quench / anneal / fountain / ...) ----
  // Every harness writes logs/<name>-status.json; anything not rendered
  // above is reported here generically. One file per run, so parallel
  // fountain probes each get their own line.
  const COVERED = new Set(['status.json', 'queue-status.json', 'boost-status.json', 'collide-status.json']);
  let hbFiles = [];
  try { hbFiles = readdirSync(join(ROOT, 'logs')).filter(f => f.endsWith('-status.json') && !COVERED.has(f)); } catch {}
  const runs = [];
  for (const f of hbFiles) {
    try { runs.push({ f, d: JSON.parse(readFileSync(join(ROOT, 'logs', f), 'utf8')) }); } catch {}
  }
  // Fresh heartbeats (<10min) always show; finished/stale runs collapse
  // into a count unless --all.
  const fresh = runs.filter(r => Date.now() - (r.d.ts ?? 0) < FRESH_MS);
  const stale = runs.length - fresh.length;
  const visible = SHOW_ALL ? runs : fresh;
  if (visible.length || stale) {
    console.log('  EXPERIMENT FLEET');
    for (const { f, d } of visible) {
      const age = Date.now() - (d.ts ?? 0);
      const alive = age < 120000;
      const label = f.replace('-status.json', '');
      const name = d.scenario ?? d.seed ?? d.mode ?? label;
      const bits = [];
      if (d.phase === 'ticking' && d.t != null) bits.push(`t${d.t}${d.ticks ? '/' + d.ticks : ''}`);
      else if (d.phase) bits.push(d.phase);
      for (const k of ['live', 'arcLive', 'freeEnds', 'maxCycle', 'nCycles', 'gap', 'hA', 'level'])
        if (d[k] != null) bits.push(`${k}=${d[k]}`);
      console.log(`  ${name} [${label}] ${bits.join(' ')}${alive ? '' : ' [STALE]'}`);
    }
    if (stale && !SHOW_ALL) console.log(`  …${stale} finished/stale runs hidden (--all to show)`);
  }
  console.log('');
  return _lines.join('\n');
}

// In-place redraw on a TTY: cursor-home, then each line written with an
// erase-to-EOL so shorter replacement lines can't leave stale tails, a
// final erase-to-end clears surplus rows from longer previous frames,
// and lines are clamped to the terminal width so wrapping can't shift
// the row cursor. Plain append when piped.
let drawn = false;
const draw = () => {
  const s = render();
  if (!process.stdout.isTTY) { process.stdout.write(s + '\n'); return; }
  const cols = process.stdout.columns || 120;
  const stamp = `  ${new Date().toLocaleTimeString()} — refresh ${WATCH}s, Ctrl+C to exit`;
  const body = (s + '\n' + stamp).split('\n')
    .map(l => l.length > cols ? l.slice(0, cols) : l)
    .join('\x1b[K\n');
  process.stdout.write((drawn ? '\x1b[H' : '\x1b[2J\x1b[H') + body + '\x1b[K\x1b[0J');
  drawn = true;
};

if (WATCH > 0) { draw(); setInterval(draw, WATCH * 1000); }
else process.stdout.write(render() + '\n');

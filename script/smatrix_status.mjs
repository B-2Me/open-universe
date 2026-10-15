#!/usr/bin/env node
/*
 * script/smatrix_status.mjs — remote smatrix listener dashboard.
 *
 *   node script/smatrix_status.mjs [--host=192.168.68.51] [--port=9898]
 *   node script/smatrix_status.mjs --watch[=seconds]
 *
 * Combines /health (queue depth, running job id), /status (the running
 * job's heartbeat: phase, tick, spray/absorbed counters) and /result/<id>
 * (artifact count — dump frames written so far).
 */
import http from 'node:http';

const arg = (k, d) => {
  const a = process.argv.slice(2).find(a => a === `--${k}` || a.startsWith(`--${k}=`));
  return a ? (a.includes('=') ? a.split('=').slice(1).join('=') : true) : d;
};
const HOST = arg('host', '192.168.68.51'), PORT = arg('port', 9898);
const WATCH = arg('watch', false);
const POLL = WATCH === true ? 5000 : +WATCH * 1000;

const getJson = (path) => new Promise((res) => {
  const req = http.get(`http://${HOST}:${PORT}${path}`, { timeout: 5000 }, (r) => {
    let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch { res(null); } });
  });
  req.on('error', () => res(null)); req.on('timeout', () => { req.destroy(); res(null); });
});

const once = async () => {
  const health = await getJson('/health');
  if (!health) { console.log(`${HOST}:${PORT} — unreachable`); return false; }
  const st = await getJson('/status');
  let line = `${HOST}:${PORT}  up  running=${health.running} queued=${health.queued}`;
  if (st?.phase && st.phase !== 'idle') {
    line += `  ${st.phase} t=${st.t ?? '?'}` +
      (st.sprayEvents != null ? ` spray=${st.sprayEvents}/${st.sprayQuanta}` : '') +
      (st.absorbed != null ? ` absorbed=${(+st.absorbed).toLocaleString()}` : '') +
      (st.absorbedPer ? `  per=[${st.absorbedPer.slice(0, 12).map(v => (+v).toLocaleString()).join(',')}${st.absorbedPer.length > 12 ? ',…' : ''}]` : '');
    if (st.ts) {
      const age = Math.round((Date.now() - st.ts) / 1000);
      line += `  (${age}s ago${age > 120 ? ' — STALE' : ''})`;
    }
    if (health.running >= 0) {
      const res = await getJson(`/result/${health.running}`);
      if (res?.files) line += `  files=${res.files.length}`;
    }
  } else {
    line += `  idle`;
  }
  console.log(line);
  return true;
};

if (!WATCH) { await once(); }
else {
  while (await once()) await new Promise(r => setTimeout(r, POLL));
}

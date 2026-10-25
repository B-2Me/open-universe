import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { pathToFileURL } from 'url';
import { remark } from 'remark';
import * as mm from 'music-metadata';
import OpenAI from 'openai';
import decode from 'audio-decode';
import { execSync } from 'child_process';

const openai = new OpenAI({
  baseURL: 'https://voice.i.rickey.io/v1',
  apiKey: 'open-universe-build',
});

const CONTENT_DIR = './docs';
const AUDIO_OUT_DIR = './docs/public/audio';
const SYNC_MAP_DIR = './docs/public/audio/sync-maps';

// Sync-map timing scheme version, recorded in the .hash sidecar as
// "vN:<textHash>". Bumping N forces a map-only realign (no TTS regen)
// on the next run; a bare legacy hash realigns too since the map is v1.
const MAP_VERSION = 'v2';

// --- Measured-alignment sync -------------------------------------------------
// Nodes are joined by ' ... ' which TTS voices as real pauses, plus the mp3
// has lead/trail encoder silence. The old map spread totalDuration across
// nodes by char count alone, smearing that silence inside node windows so
// every highlight fired early. Now we decode the mp3, find the actual
// silence gaps, and snap each node's expected boundary to the nearest gap:
// node windows become real speech edges.

const WIN = 2048, HOP = 1024;      // 46ms window / 23ms hop @44.1k
const SIL_FLOOR = 0.04;            // silence = RMS below 4% of peak
const MIN_INTERIOR_SIL = 0.18;     // ' ... ' pauses run ~0.3-1s
const MIN_EDGE_SIL = 0.03;         // lead/trail padding: any clear run
const SNAP_MAX = 1.5;              // refuse to snap a boundary further than this

function silenceIntervals(pcm, sr) {
  const dur = pcm.length / sr;
  let peak = 0;
  const rms = [];
  for (let i = 0; i + WIN <= pcm.length; i += HOP) {
    let s = 0;
    for (let j = i; j < i + WIN; j++) s += pcm[j] * pcm[j];
    const v = Math.sqrt(s / WIN);
    rms.push(v);
    if (v > peak) peak = v;
  }
  const floor = peak * SIL_FLOOR;
  const sil = [];
  let run = -1;
  const close = (end) => {
    const atEdge = run <= HOP / sr || end >= dur - HOP / sr;
    if (end - run >= (atEdge ? MIN_EDGE_SIL : MIN_INTERIOR_SIL))
      sil.push({ start: run, end });
    run = -1;
  };
  for (let i = 0; i < rms.length; i++) {
    const t = i * HOP / sr;
    if (rms[i] < floor) { if (run < 0) run = t; }
    else if (run >= 0) close(t);
  }
  if (run >= 0) close(dur);
  return sil;
}

function alignNodes(nodes, sil, dur) {
  // Speech segments = complement of silences.
  const segs = [];
  let prev = 0;
  for (const s of sil) { if (s.start > prev) segs.push({ start: prev, end: s.start }); prev = s.end; }
  if (prev < dur) segs.push({ start: prev, end: dur });
  if (!segs.length) return null;

  // Expected boundaries by char proportion (same anchor as before).
  const totalChars = nodes.reduce((a, n) => a + n.charCount, 0);
  const expected = [];
  let cum = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    cum += nodes[i].charCount;
    expected.push(dur * cum / totalChars);
  }

  // Gap candidates for boundaries: interior silences (lead/trail can't
  // split two nodes).
  const gaps = [];
  for (let j = 0; j + 1 < segs.length; j++) gaps.push({ start: segs[j].end, end: segs[j + 1].start });

  // Greedy in-order snap: each expected boundary claims the unused gap
  // nearest to it within SNAP_MAX; otherwise it stays proportional.
  const bounds = [segs[0].start];
  let gi = 0;
  let lastBound = segs[0].start;
  for (const e of expected) {
    let best = -1, bd = Infinity;
    for (let g = gi; g < gaps.length; g++) {
      const mid = (gaps[g].start + gaps[g].end) / 2;
      if (mid <= lastBound) continue;
      const d = Math.abs(mid - e);
      if (d < bd) { bd = d; best = g; }
      else if (mid > e) break;
    }
    if (best >= 0 && bd <= SNAP_MAX) {
      bounds.push(gaps[best]);
      lastBound = gaps[best].end;
      gi = best + 1;
    } else {
      bounds.push(e);
      lastBound = e;
    }
  }
  bounds.push(segs[segs.length - 1].end);

  return nodes.map((n, i) => {
    const b = bounds[i + 1];
    return {
      text: n.originalText,
      start: Number((typeof bounds[i] === 'object' ? bounds[i].end : bounds[i]).toFixed(3)),
      end: Number((typeof b === 'object' ? b.start : b).toFixed(3)),
    };
  });
}

function proportionalNodes(nodes, dur) {
  const totalChars = nodes.reduce((a, n) => a + n.charCount, 0);
  let t = 0;
  return nodes.map(n => {
    const end = t + dur * n.charCount / totalChars;
    const e = { text: n.originalText, start: Number(t.toFixed(3)), end: Number(end.toFixed(3)) };
    t = end;
    return e;
  });
}

async function buildSyncEntries(nodes, mp3Buf, dur) {
  try {
    const { channelData, sampleRate } = await decode(mp3Buf);
    const aligned = alignNodes(nodes, silenceIntervals(channelData[0], sampleRate), channelData[0].length / sampleRate);
    if (aligned) return aligned;
  } catch (e) { /* decode/analysis failure → fall through */ }
  console.warn('  sync map falling back to proportional timing');
  return proportionalNodes(nodes, dur);
}
// -----------------------------------------------------------------------------

// Helper to get the actual Git commit time (returns milliseconds)
function getGitCommitTimeMs(filePath) {
  try {
    const result = execSync(`git log -1 --format=%ct -- "${filePath}"`, { stdio: 'pipe', encoding: 'utf-8' }).trim();
    return result ? parseInt(result, 10) * 1000 : null;
  } catch (e) {
    return null; // Fails gracefully if the file isn't in git yet
  }
}

// Recursively extract text, deliberately ignoring HTML/Vue component nodes
function extractText(node) {
  if (node.type === 'html') return ''; 
  if (node.value) return node.value;
  if (node.children) return node.children.map(extractText).join('');
  return '';
}

function getRenderableNodes(node, nodes = []) {
  if (!node) return nodes;

  if (node.type === 'heading' || node.type === 'paragraph') {
    nodes.push(node);
  } else if (node.type === 'listItem') {
    const hasBlockChild = node.children && node.children.some(c => c.type === 'paragraph' || c.type === 'heading');
    if (!hasBlockChild) {
      nodes.push(node);
    }
    if (node.children) {
      for (const child of node.children) {
        getRenderableNodes(child, nodes);
      }
    }
  } else if (node.children) {
    for (const child of node.children) {
      getRenderableNodes(child, nodes);
    }
  }
  return nodes;
}

function sanitizeTextForTTS(text) {
  let sanitized = text;

  // 1. Translate LaTeX Formulas to Phonetic English
  const mathMap = {
    'F = T \\frac{\\Delta S}{\\Delta x}': 'F equals T times the change in S over the change in X',
    'C_{max}^2 = C_s^2 + C_i^2': 'C max squared equals C S squared plus C I squared',
    'E_{received} = E_{emitted} e^{-\\mu d}': 'E received equals E emitted, times E to the negative mu D',
    '\\Phi = \\tau \\cdot \\Delta_{mod}(s_1, s_2)': 'Phi equals tau times the modular change between S one and S two',
    'Y_{act} = (N_{nodes} \\cdot \\tau_{knot}) \\times \\Omega_{max}': 'Y act equals N nodes times tau knot, multiplied by Omega max',
    'E=mc^2': 'E equals M C squared',
    'C_{max}': 'C max',
    'C_s': 'C S',
    'C_i': 'C I',
    '\\Delta S': 'delta S',
    '\\Delta x': 'delta X',
    '\\Omega_{max}': 'Omega max'
  };

  for (const [formula, spoken] of Object.entries(mathMap)) {
    const escapedFormula = formula.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const regex = new RegExp(`\\$*${escapedFormula}\\$*`, 'g');
    sanitized = sanitized.replace(regex, spoken);
  }

  // 2. Translate Roman Numerals
  const romanMap = {
    'I': 'One', 'II': 'Two', 'III': 'Three', 'IV': 'Four', 'V': 'Five',
    'VI': 'Six', 'VII': 'Seven', 'VIII': 'Eight', 'IX': 'Nine', 'X': 'Ten',
    'XI': 'Eleven', 'XII': 'Twelve', 'XIII': 'Thirteen', 'XIV': 'Fourteen',
    'XV': 'Fifteen', 'XVI': 'Sixteen', 'XVII': 'Seventeen', 'XVIII': 'Eighteen',
    'XIX': 'Nineteen', 'XX': 'Twenty'
  };
  
  sanitized = sanitized.replace(/^([^a-zA-Z0-9]*)(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)\.\s/g, (match, prefix, numeral) => {
    return `${prefix}${romanMap[numeral]}. `;
  });

  // 3. Strip HTML Tags
  sanitized = sanitized.replace(/<[^>]+>/g, '');
  
  // 4. Clean up any remaining isolated dollar signs
  sanitized = sanitized.replace(/\$/g, '');

  return sanitized.trim();
}

// Pages that get no narration: the landing hero and the live
// instruments (the Tools — simulators, not prose).
const SKIP = new Set(['loom-demo', 'wake-demo', 'ember-demo', 'mill-demo', 'hopfion-zoo']);

async function processFile(filePath) {
  const filename = path.basename(filePath, '.md');
  if (SKIP.has(filename)) return;

  const finalAudioPath = path.join(AUDIO_OUT_DIR, `${filename}.mp3`);
  const syncMapPath = path.join(SYNC_MAP_DIR, `${filename}.json`);
  const hashPath = path.join(SYNC_MAP_DIR, `${filename}.hash`);

  const content = await fs.readFile(filePath, 'utf-8');
  const bodyContent = content.replace(/^[\s\uFEFF]*---\r?\n[\s\S]*?\r?\n---/, '');

  const parsedAST = remark().parse(bodyContent);
  const rawNodes = getRenderableNodes({ children: parsedAST.children });

  // Content-hash skip: the sync map records the hash of the exact text
  // that was narrated, so a cached artifact regenerates only when the
  // prose actually changed — mtime races (CI checkout, cache restore)
  // can't misfire either way.
  const textHash = (() => {
    const h = crypto.createHash('sha256');
    for (const node of rawNodes) h.update(sanitizeTextForTTS(extractText(node)) || '');
    return h.digest('hex').slice(0, 16);
  })();

  // Three states: fully current (hash match → skip), audio current but map
  // stale (text unchanged, map needs realign → decode existing mp3, no TTS),
  // or needs full regen.
  let audioFresh = false;
  try {
    const [prevHash, , ] = await Promise.all([
      fs.readFile(hashPath, 'utf-8'), fs.stat(finalAudioPath), fs.stat(syncMapPath),
    ]);
    const stored = prevHash.trim();
    if (stored === `${MAP_VERSION}:${textHash}`) {
      console.log(`Skipping ${filename} (content + map version unchanged)`);
      return;
    }
    // Bare hash or other-version hash with same text → audio is current.
    if (stored === textHash || stored.endsWith(`:${textHash}`)) audioFresh = true;
  } catch (err) {
    try {
      const mdStat = await fs.stat(filePath);
      const mp3Stat = await fs.stat(finalAudioPath);
      const mdTime = getGitCommitTimeMs(filePath) ?? mdStat.mtimeMs;
      const mp3Time = getGitCommitTimeMs(finalAudioPath) ?? mp3Stat.mtimeMs;
      if (mp3Time >= mdTime) {
        // Audio is fresh; the map still needs the realign pass.
        audioFresh = true;
      }
    } catch (e) { /* missing artifact → generate */ }
  }
  
  const contentNodes = [];

  for (const node of rawNodes) {
    let rawText = extractText(node).replace(/\n/g, ' ');
    let sanitizedText = sanitizeTextForTTS(rawText);
    
    if (sanitizedText) {
      contentNodes.push({ 
        originalText: sanitizedText, 
        ttsText: sanitizedText,          
        charCount: sanitizedText.length
      });
    }
  }

  if (contentNodes.length === 0) return;

  // The ' ... ' separator is load-bearing twice: it gives the narrator a
  // breath between blocks AND creates the silence gaps buildSyncEntries
  // aligns node boundaries to.
  const fullPageText = contentNodes.map(n => n.ttsText).join(' ... ');

  await fs.mkdir(AUDIO_OUT_DIR, { recursive: true });
  await fs.mkdir(SYNC_MAP_DIR, { recursive: true });

  // Atomic commit: generate + analyze first, write to .tmp, then rename.
  // A TTS/decode failure or mid-write crash must never replace a working
  // (mp3, map) pair — stale audio beats no audio.
  const tmpAudio = finalAudioPath + '.tmp';
  const tmpMap = syncMapPath + '.tmp';
  try {
    let buffer;
    if (audioFresh) {
      console.log(`Realigning sync map for ${filename} (audio current, no TTS call)`);
      buffer = await fs.readFile(finalAudioPath);
    } else {
      console.log(`Generating MP3 & sync map for ${filename} (${contentNodes.length} nodes)...`);
      const mp3 = await openai.audio.speech.create({
        model: 'kokoro',
        voice: 'af_bella',
        input: fullPageText,
      });
      buffer = Buffer.from(await mp3.arrayBuffer());
      await fs.writeFile(tmpAudio, buffer);
    }

    const metadata = await mm.parseBuffer(buffer);
    const totalDuration = metadata.format.duration;

    const syncEntries = await buildSyncEntries(contentNodes, buffer, totalDuration);

    await fs.writeFile(tmpMap, JSON.stringify(syncEntries, null, 2));

    // Renames are atomic; hash is written last as the commit marker. A
    // crash between the two renames self-heals next run: the mismatched
    // pair fails the hash check and the realign path rebuilds the map.
    if (!audioFresh) await fs.rename(tmpAudio, finalAudioPath);
    await fs.rename(tmpMap, syncMapPath);
    await fs.writeFile(hashPath, `${MAP_VERSION}:${textHash}\n`);
  } catch (err) {
    await Promise.all([
      fs.unlink(tmpAudio).catch(() => {}),
      fs.unlink(tmpMap).catch(() => {}),
    ]);
    throw err;
  }

  let updatedContent = content;
  if (!updatedContent.includes('audio: ')) {
    updatedContent = updatedContent.replace(
      /^[\s\uFEFF]*---\r?\n([\s\S]*?)\r?\n---/, 
      `---\n$1\naudio: /audio/${filename}.mp3\n---`
    );
    await fs.writeFile(filePath, updatedContent);
  }

  console.log(`Successfully generated audio and sync map for ${filename}`);
}

// Recursive walk — section pages like docs/interference/*.md are prose
// too and deserve narration. Basenames must stay unique: <name>.mp3 is
// flat inside docs/public/audio/.
async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'public' || entry.name === 'node_modules') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.name.endsWith('.md')) yield p;
  }
}

async function run() {
  for await (const filePath of walk(CONTENT_DIR)) {
    await processFile(filePath);
  }
}

// Guard: importing this file (e.g. a test harness) must not trigger a run.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(console.error);
}

export { silenceIntervals, alignNodes, buildSyncEntries, proportionalNodes };

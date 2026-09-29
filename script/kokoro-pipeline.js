import fs from 'fs/promises';
import path from 'path';
import { remark } from 'remark';
import * as mm from 'music-metadata';
import OpenAI from 'openai';
import { execSync } from 'child_process';

const openai = new OpenAI({
  baseURL: 'https://voice.i.rickey.io/v1',
  apiKey: 'open-universe-build',
});

const CONTENT_DIR = './docs';
const AUDIO_OUT_DIR = './docs/public/audio';
const SYNC_MAP_DIR = './docs/public/audio/sync-maps';

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

async function processFile(filePath) {
  const filename = path.basename(filePath, '.md');
  if (filename === 'index') return; 

  const finalAudioPath = path.join(AUDIO_OUT_DIR, `${filename}.mp3`);
  const syncMapPath = path.join(SYNC_MAP_DIR, `${filename}.json`);

  try {
    const mdStat = await fs.stat(filePath);
    const mp3Stat = await fs.stat(finalAudioPath);
    const syncMapStat = await fs.stat(syncMapPath);
    
    // Check Git commit time to bypass the GitHub Actions bulk-download timestamp issue.
    // Fallback to local file system time if the file isn't tracked in git yet.
    const mdTime = getGitCommitTimeMs(filePath) ?? mdStat.mtimeMs;
    const mp3Time = getGitCommitTimeMs(finalAudioPath) ?? mp3Stat.mtimeMs;
    const syncMapTime = getGitCommitTimeMs(syncMapPath) ?? syncMapStat.mtimeMs;
    
    if (mp3Time >= mdTime && syncMapTime >= mdTime) {
      console.log(`Skipping ${filename} (Audio and sync map are up to date)`);
      return;
    }
  } catch (err) {
    // If the mp3 or sync map doesn't exist at all, fs.stat throws, and we proceed to generate.
  }

  const content = await fs.readFile(filePath, 'utf-8');
  const bodyContent = content.replace(/^[\s\uFEFF]*---\r?\n[\s\S]*?\r?\n---/, '');

  const parsedAST = remark().parse(bodyContent);
  const rawNodes = getRenderableNodes({ children: parsedAST.children });
  
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

  const fullPageText = contentNodes.map(n => n.ttsText).join(' ... ');

  console.log(`Generating MP3 & sync map for ${filename} (${contentNodes.length} nodes)...`);
  await fs.mkdir(AUDIO_OUT_DIR, { recursive: true });
  await fs.mkdir(SYNC_MAP_DIR, { recursive: true });

  const mp3 = await openai.audio.speech.create({
    model: 'kokoro', 
    voice: 'af_bella',
    input: fullPageText,
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  await fs.writeFile(finalAudioPath, buffer);

  const metadata = await mm.parseFile(finalAudioPath);
  const totalDuration = metadata.format.duration;
  
  const totalChars = contentNodes.reduce((acc, n) => acc + n.charCount, 0);
  
  let currentTime = 0; 
  const syncEntries = [];

  for (const item of contentNodes) {
    const charRatio = item.charCount / totalChars;
    const speechTimeForNode = totalDuration * charRatio;

    const startTime = currentTime;
    const endTime = currentTime + speechTimeForNode;

    syncEntries.push({
      text: item.originalText, 
      start: Number(startTime.toFixed(3)),
      end: Number(endTime.toFixed(3))
    });

    currentTime = endTime;
  }

  await fs.writeFile(syncMapPath, JSON.stringify(syncEntries, null, 2));

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

async function run() {
  const files = await fs.readdir(CONTENT_DIR);
  for (const file of files) {
    if (file.endsWith('.md')) {
      await processFile(path.join(CONTENT_DIR, file));
    }
  }
}

run().catch(console.error);

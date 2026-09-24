import fs from 'fs/promises';
import path from 'path';
import { remark } from 'remark';
import * as mm from 'music-metadata';
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://voice.i.rickey.io/v1',
  apiKey: 'local-key',
});

const CONTENT_DIR = './docs';
const AUDIO_OUT_DIR = './docs/public/audio';
const SYNC_MAP_DIR = './docs/public/audio/sync-maps';

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
  const romanMap = {
    'I': 'One', 'II': 'Two', 'III': 'Three', 'IV': 'Four', 'V': 'Five',
    'VI': 'Six', 'VII': 'Seven', 'VIII': 'Eight', 'IX': 'Nine', 'X': 'Ten',
    'XI': 'Eleven', 'XII': 'Twelve', 'XIII': 'Thirteen', 'XIV': 'Fourteen',
    'XV': 'Fifteen', 'XVI': 'Sixteen', 'XVII': 'Seventeen', 'XVIII': 'Eighteen',
    'XIX': 'Nineteen', 'XX': 'Twenty'
  };
  
  let sanitized = text.replace(/^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)\.\s/g, (match, p1) => {
    return `${romanMap[p1]}. `;
  });

  sanitized = sanitized.replace(/<[^>]+>/g, '');
  sanitized = sanitized.replace(/\$/g, '');

  return sanitized.trim();
}

async function processFile(filePath) {
  const filename = path.basename(filePath, '.md');
  if (filename === 'index') return; 

  const content = await fs.readFile(filePath, 'utf-8');
  const finalAudioPath = path.join(AUDIO_OUT_DIR, `${filename}.mp3`);
  const syncMapPath = path.join(SYNC_MAP_DIR, `${filename}.json`);

  try {
    const mdStat = await fs.stat(filePath);
    const mp3Stat = await fs.stat(finalAudioPath);
    const syncMapStat = await fs.stat(syncMapPath);
    
    if (mp3Stat.mtime > mdStat.mtime && syncMapStat.mtime > mdStat.mtime) {
      console.log(`Skipping ${filename} (Audio and sync map are up to date)`);
      return;
    }
  } catch (err) {}

  // --- NEW: Robust Frontmatter Stripping ---
  // This strips the YAML frontmatter even if there is a hidden BOM or leading space
  const bodyContent = content.replace(/^[\s\uFEFF]*---\r?\n[\s\S]*?\r?\n---/, '');

  const parsedAST = remark().parse(bodyContent);
  const rawNodes = getRenderableNodes({ children: parsedAST.children });
  
  const contentNodes = [];
  const PAGE_START_PAUSE = 1.0;
  let totalInjectedPauses = PAGE_START_PAUSE;

  for (const node of rawNodes) {
    let rawText = extractText(node).replace(/\n/g, ' ');
    let sanitizedText = sanitizeTextForTTS(rawText);
    
    if (sanitizedText) {
      let addedPause = 0;
      let ttsString = sanitizedText;

      if (node.type === 'heading') {
        ttsString += ' [pause: 1.5s]';
        addedPause = 1.5;
      } else {
        ttsString += ' [pause: 0.5s]';
        addedPause = 0.5;
      }

      totalInjectedPauses += addedPause;

      contentNodes.push({ 
        originalText: sanitizedText, 
        ttsText: ttsString,          
        charCount: sanitizedText.length,
        pauseTime: addedPause
      });
    }
  }

  if (contentNodes.length === 0) return;

  const fullPageText = `[pause:${PAGE_START_PAUSE}s] ` + contentNodes.map(n => n.ttsText).join(' ');

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

  let pureSpeechDuration = totalDuration - totalInjectedPauses;
  if (pureSpeechDuration <= 0) {
    pureSpeechDuration = totalDuration; 
    totalInjectedPauses = 0;
  }

  const totalChars = contentNodes.reduce((acc, n) => acc + n.charCount, 0);
  let currentTime = PAGE_START_PAUSE; 
  const syncEntries = [];

  for (const item of contentNodes) {
    const charRatio = item.charCount / totalChars;
    const speechTimeForNode = pureSpeechDuration * charRatio;

    const startTime = currentTime;
    const endTime = currentTime + speechTimeForNode;

    syncEntries.push({
      text: item.originalText, 
      start: Number(startTime.toFixed(3)),
      end: Number(endTime.toFixed(3))
    });

    currentTime = endTime + (totalInjectedPauses > 0 ? item.pauseTime : 0);
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

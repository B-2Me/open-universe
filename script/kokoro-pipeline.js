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

function extractText(node) {
  if (node.value) return node.value;
  if (node.children) return node.children.map(extractText).join('');
  return '';
}

// Recursively walk the AST to collect all readable content blocks (headings, paragraphs, list items)
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

async function processFile(filePath) {
  const filename = path.basename(filePath, '.md');
  if (filename === 'index') return; // Skip hero landing page

  const content = await fs.readFile(filePath, 'utf-8');
  const finalAudioPath = path.join(AUDIO_OUT_DIR, `${filename}.mp3`);
  const syncMapPath = path.join(SYNC_MAP_DIR, `${filename}.json`);

  // Robust cache check: verify that BOTH the MP3 and the JSON sync map are newer than the Markdown file
  try {
    const mdStat = await fs.stat(filePath);
    const mp3Stat = await fs.stat(finalAudioPath);
    const syncMapStat = await fs.stat(syncMapPath);
    
    if (mp3Stat.mtime > mdStat.mtime && syncMapStat.mtime > mdStat.mtime) {
      console.log(`Skipping ${filename} (Audio and sync map are up to date)`);
      return;
    }
  } catch (err) {
    // If either file is missing or stats fail, it falls through to regenerate both from scratch
  }

  let bodyStartIndex = 0;
  if (content.startsWith('---')) {
    const endOfFrontmatter = content.indexOf('---', 3);
    if (endOfFrontmatter !== -1) {
      bodyStartIndex = endOfFrontmatter + 3;
    }
  }

  const bodyContent = content.substring(bodyStartIndex);
  const parsedAST = remark().parse(bodyContent);

  const rawNodes = getRenderableNodes({ children: parsedAST.children });
  const contentNodes = [];

  for (const node of rawNodes) {
    const textForTTS = extractText(node).replace(/\n/g, ' ');
    if (textForTTS.trim()) {
      contentNodes.push({ type: node.type, text: textForTTS });
    }
  }

  if (contentNodes.length === 0) return;

  const PAUSE_DURATION = 1.0; 
  const joinedText = contentNodes.map(n => n.text).join(' ');
  const fullPageText = `[pause:${PAUSE_DURATION}s] ` + joinedText;

  console.log(`Generating continuous MP3 and sync map for ${filename} (${contentNodes.length} nodes)...`);
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

  const totalChars = joinedText.length;
  const speechDuration = totalDuration - PAUSE_DURATION;
  let currentTime = PAUSE_DURATION; 
  const syncEntries = [];

  for (const item of contentNodes) {
    const charRatio = item.text.length / totalChars;
    const nodeDuration = speechDuration * charRatio;

    const startTime = currentTime;
    const endTime = currentTime + nodeDuration;
    currentTime = endTime;

    syncEntries.push({
      text: item.text,
      start: Number(startTime.toFixed(3)),
      end: Number(endTime.toFixed(3))
    });
  }

  await fs.writeFile(syncMapPath, JSON.stringify(syncEntries, null, 2));

  let updatedContent = content;
  if (!updatedContent.includes('audio: ')) {
    updatedContent = updatedContent.replace(
      /^---\r?\n([\s\S]*?)\r?\n---/, 
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
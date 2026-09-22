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

function extractText(node) {
  if (node.value) return node.value;
  if (node.children) return node.children.map(extractText).join('');
  return '';
}

async function processFile(filePath) {
  const filename = path.basename(filePath, '.md');
  if (filename === 'index') return; // Skip hero landing page

  const content = await fs.readFile(filePath, 'utf-8');
  
  if (content.includes('class="sync-text"')) {
    console.log(`Skipping ${filename} (Already contains sync tags)`);
    return;
  }

  const finalAudioPath = path.join(AUDIO_OUT_DIR, `${filename}.mp3`);

  try {
    const mdStat = await fs.stat(filePath);
    const mp3Stat = await fs.stat(finalAudioPath);
    if (mp3Stat.mtime > mdStat.mtime) {
      console.log(`Skipping ${filename} (Audio is up to date)`);
      return;
    }
  } catch (err) {}

  let bodyStartIndex = 0;
  if (content.startsWith('---')) {
    const endOfFrontmatter = content.indexOf('---', 3);
    if (endOfFrontmatter !== -1) {
      bodyStartIndex = endOfFrontmatter + 3;
    }
  }

  const bodyContent = content.substring(bodyStartIndex);
  const parsedAST = remark().parse(bodyContent);

  // Collect both paragraphs and headings so subtitles/titles get narrated
  const contentNodes = [];
  for (const node of parsedAST.children) {
    if (node.type === 'paragraph' || node.type === 'heading') {
      const textForTTS = extractText(node).replace(/\n/g, ' ');
      if (textForTTS.trim()) {
        contentNodes.push({ node, text: textForTTS });
      }
    }
  }

  if (contentNodes.length === 0) return;

  const PAUSE_DURATION = 1.0; 
  const joinedText = contentNodes.map(n => n.text).join(' ');
  const fullPageText = `[pause:${PAUSE_DURATION}s] ` + joinedText;

  console.log(`Generating single audio file with headers for ${filename}...`);
  await fs.mkdir(AUDIO_OUT_DIR, { recursive: true });

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
  const replacements = [];

  for (const item of contentNodes) {
    const charRatio = item.text.length / totalChars;
    const nodeDuration = speechDuration * charRatio;

    const startTime = currentTime;
    const endTime = currentTime + nodeDuration;
    currentTime = endTime;

    const absoluteStart = item.node.position.start.offset + bodyStartIndex;
    const absoluteEnd = item.node.position.end.offset + bodyStartIndex;
    const rawMarkdown = content.substring(absoluteStart, absoluteEnd);

    replacements.push({
      start: absoluteStart,
      end: absoluteEnd,
      newText: `<span class="sync-text" data-start="${startTime.toFixed(3)}" data-end="${endTime.toFixed(3)}">${rawMarkdown}</span>`
    });
  }

  let updatedContent = content;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i];
    updatedContent = updatedContent.substring(0, r.start) + r.newText + updatedContent.substring(r.end);
  }

  if (!updatedContent.includes('audio: ')) {
    updatedContent = updatedContent.replace(
      /^---\r?\n([\s\S]*?)\r?\n---/, 
      `---\n$1\naudio: /audio/${filename}.mp3\n---`
    );
  }

  await fs.writeFile(filePath, updatedContent);
  console.log(`Successfully generated audio and synced paragraphs + headings for ${filename}`);
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

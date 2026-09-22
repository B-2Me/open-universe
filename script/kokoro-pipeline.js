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

  const paragraphs = [];
  for (const node of parsedAST.children) {
    if (node.type === 'paragraph') {
      const textForTTS = extractText(node).replace(/\n/g, ' ');
      if (textForTTS.trim()) {
        paragraphs.push({ node, text: textForTTS });
      }
    }
  }

  if (paragraphs.length === 0) return;

  // Define your desired leading silence duration in seconds
  const PAUSE_DURATION = 1.0; 
  const joinedText = paragraphs.map(p => p.text).join(' ');
  
  // Prepend the Kokoro-FastAPI control token for precise zero-padding
  const fullPageText = `[pause:${PAUSE_DURATION}s] ` + joinedText;

  console.log(`Generating single audio file with ${PAUSE_DURATION}s leading silence for ${filename}...`);
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

  // Calculate proportional timestamps starting after the leading pause
  const totalChars = joinedText.length;
  const speechDuration = totalDuration - PAUSE_DURATION;
  let currentTime = PAUSE_DURATION; // Offset initial highlight tracking by the pause length
  const replacements = [];

  for (const p of paragraphs) {
    const charRatio = p.text.length / totalChars;
    const paragraphDuration = speechDuration * charRatio;

    const startTime = currentTime;
    const endTime = currentTime + paragraphDuration;
    currentTime = endTime;

    const absoluteStart = p.node.position.start.offset + bodyStartIndex;
    const absoluteEnd = p.node.position.end.offset + bodyStartIndex;
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
  console.log(`Successfully generated padded MP3 and synced ${filename}`);
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

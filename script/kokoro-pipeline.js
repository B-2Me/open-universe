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

async function generateAudioForChunk(text, index, filepath) {
  const chunkPath = `${filepath}-chunk-${index}.mp3`;
  const mp3 = await openai.audio.speech.create({
    model: 'kokoro', 
    voice: 'af_bella',
    input: text,
  });
  
  const buffer = Buffer.from(await mp3.arrayBuffer());
  await fs.writeFile(chunkPath, buffer);
  
  const metadata = await mm.parseFile(chunkPath);
  return { path: chunkPath, duration: metadata.format.duration };
}

async function mergeAudioChunks(chunks, outputPath) {
  const buffers = [];
  for (const chunk of chunks) {
    buffers.push(await fs.readFile(chunk.path));
  }
  await fs.writeFile(outputPath, Buffer.concat(buffers));
}

async function processFile(filePath) {
  const filename = path.basename(filePath, '.md');
  
  // Skip the hero landing page
  if (filename === 'index') return;

  const content = await fs.readFile(filePath, 'utf-8');
  
  // Prevent double-wrapping if the file was already processed
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

  // Safely isolate the body content to prevent parsing YAML frontmatter as TTS text
  let bodyStartIndex = 0;
  if (content.startsWith('---')) {
    const endOfFrontmatter = content.indexOf('---', 3);
    if (endOfFrontmatter !== -1) {
      bodyStartIndex = endOfFrontmatter + 3;
    }
  }

  const bodyContent = content.substring(bodyStartIndex);
  const parsedAST = remark().parse(bodyContent);

  let currentTime = 0.0;
  const audioChunks = [];
  const replacements = [];

  for (let i = 0; i < parsedAST.children.length; i++) {
    const node = parsedAST.children[i];
    
    if (node.type === 'paragraph') {
      const textForTTS = extractText(node).replace(/\n/g, ' ');
      if (!textForTTS.trim()) continue;

      console.log(`Generating audio for: "${textForTTS.substring(0, 30)}..."`);
      const chunkData = await generateAudioForChunk(textForTTS, i, filePath);
      
      const startTime = currentTime;
      const endTime = currentTime + chunkData.duration;
      currentTime = endTime;
      
      audioChunks.push(chunkData);

      // Offset the replacement index by the length of the frontmatter
      const absoluteStart = node.position.start.offset + bodyStartIndex;
      const absoluteEnd = node.position.end.offset + bodyStartIndex;
      const rawMarkdown = content.substring(absoluteStart, absoluteEnd);
      
      replacements.push({
        start: absoluteStart,
        end: absoluteEnd,
        newText: `<span class="sync-text" data-start="${startTime.toFixed(3)}" data-end="${endTime.toFixed(3)}">${rawMarkdown}</span>`
      });
    }
  }

  if (audioChunks.length > 0) {
    await fs.mkdir(AUDIO_OUT_DIR, { recursive: true });

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
    await mergeAudioChunks(audioChunks, finalAudioPath);

    for (const chunk of audioChunks) {
      await fs.unlink(chunk.path);
    }

    console.log(`Successfully generated and synced ${filename}`);
  }
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

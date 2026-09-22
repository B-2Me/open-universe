import fs from 'fs/promises';
import path from 'path';
import { remark } from 'remark';
import * as mm from 'music-metadata';
import OpenAI from 'openai';

// Point directly to your private instance
const openai = new OpenAI({
  baseURL: 'https://voice.i.rickey.io/v1',
  apiKey: 'local-key',
});

const CONTENT_DIR = './docs';
const AUDIO_OUT_DIR = './docs/public/audio';

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

// Native Node.js MP3 concatenation (No FFmpeg required)
async function mergeAudioChunks(chunks, outputPath) {
  const buffers = [];
  for (const chunk of chunks) {
    buffers.push(await fs.readFile(chunk.path));
  }
  await fs.writeFile(outputPath, Buffer.concat(buffers));
}

async function processFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  if (content.includes('audio: ')) return; // Skip if already processed

  let currentTime = 0.0;
  const audioChunks = [];
  const parsedAST = remark().parse(content);

  for (let i = 0; i < parsedAST.children.length; i++) {
    const node = parsedAST.children[i];
    
    if (node.type === 'paragraph') {
      const rawText = node.children.map(child => child.value).join(' ');
      if (!rawText.trim()) continue;

      console.log(`Generating audio: "${rawText.substring(0, 30)}..."`);
      const chunkData = await generateAudioForChunk(rawText, i, filePath);
      
      const startTime = currentTime;
      const endTime = currentTime + chunkData.duration;
      currentTime = endTime;
      
      audioChunks.push(chunkData);

      node.type = 'html';
      node.value = `<span class="sync-text" data-start="${startTime.toFixed(3)}" data-end="${endTime.toFixed(3)}">${rawText}</span>`;
      delete node.children;
    }
  }

  if (audioChunks.length > 0) {
    const filename = path.basename(filePath, '.md');
    const finalAudioPath = path.join(AUDIO_OUT_DIR, `${filename}.mp3`);
    
    await fs.mkdir(AUDIO_OUT_DIR, { recursive: true });
    await mergeAudioChunks(audioChunks, finalAudioPath);

    for (const chunk of audioChunks) {
      await fs.unlink(chunk.path);
    }

    const newMarkdown = remark().stringify(parsedAST);
    const updatedContent = newMarkdown.replace(
      /---\n/, 
      `---\naudio: /audio/${filename}.mp3\n`
    );

    await fs.writeFile(filePath, updatedContent);
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

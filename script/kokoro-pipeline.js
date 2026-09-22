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
  const content = await fs.readFile(filePath, 'utf-8');
  const filename = path.basename(filePath, '.md');
  const finalAudioPath = path.join(AUDIO_OUT_DIR, `${filename}.mp3`);

  // 1. Check Modification Times (mtime)
  try {
    const mdStat = await fs.stat(filePath);
    const mp3Stat = await fs.stat(finalAudioPath);
    
    // If the MP3 exists and is newer than the Markdown file, skip processing
    if (mp3Stat.mtime > mdStat.mtime) {
      console.log(`Skipping ${filename} (Audio is up to date)`);
      return;
    }
  } catch (err) {
    // If the MP3 doesn't exist, the stat check throws an error. Proceed with generation.
  }

  let currentTime = 0.0;
  const audioChunks = [];
  const parsedAST = remark().parse(content);

  for (let i = 0; i < parsedAST.children.length; i++) {
    const node = parsedAST.children[i];
    
    if (node.type === 'paragraph') {
      const rawText = node.children.map(child => child.value).join(' ');
      if (!rawText.trim()) continue;

      console.log(`Generating audio for: "${rawText.substring(0, 30)}..."`);
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
    await fs.mkdir(AUDIO_OUT_DIR, { recursive: true });

    const newMarkdown = remark().stringify(parsedAST);
    let updatedContent = newMarkdown;
    if (!updatedContent.includes('audio: ')) {
      updatedContent = newMarkdown.replace(
        /---\n/, 
        `---\naudio: /audio/${filename}.mp3\n`
      );
    }

    // 2. The Write-Order Fix
    // Write the Markdown file FIRST
    await fs.writeFile(filePath, updatedContent);

    // Merge and write the MP3 LAST, ensuring the MP3 mtime is definitively newer than the Markdown mtime
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

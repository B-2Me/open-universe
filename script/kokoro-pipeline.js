import fs from 'fs/promises';
import path from 'path';
import { remark } from 'remark';
import * as mm from 'music-metadata';
import OpenAI from 'openai';

// Point directly to your private Kokoro-FastAPI instance
const openai = new OpenAI({
  baseURL: 'https://voice.i.rickey.io/v1',
  apiKey: 'local-key',
});

const CONTENT_DIR = './docs';
const AUDIO_OUT_DIR = './docs/public/audio';

// Recursively extracts plain text from the AST so bold/italic words aren't lost
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
  const replacements = [];
  const parsedAST = remark().parse(content);

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

      // Extract the exact raw markdown directly from the original file using AST position offsets
      const rawMarkdown = content.substring(node.position.start.offset, node.position.end.offset);
      
      // Store the replacement to be applied later
      replacements.push({
        start: node.position.start.offset,
        end: node.position.end.offset,
        newText: `<span class="sync-text" data-start="${startTime.toFixed(3)}" data-end="${endTime.toFixed(3)}">${rawMarkdown}</span>`
      });
    }
  }

  if (audioChunks.length > 0) {
    await fs.mkdir(AUDIO_OUT_DIR, { recursive: true });

    // Apply replacements from bottom to top so the character offsets don't shift during injection
    let updatedContent = content;
    for (let i = replacements.length - 1; i >= 0; i--) {
      const r = replacements[i];
      updatedContent = updatedContent.substring(0, r.start) + r.newText + updatedContent.substring(r.end);
    }

    // Safely inject frontmatter avoiding Windows/Unix line-ending conflicts
    if (!updatedContent.includes('audio: ')) {
      updatedContent = updatedContent.replace(
        /^---\r?\n([\s\S]*?)\r?\n---/, 
        `---\n$1\naudio: /audio/${filename}.mp3\n---`
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

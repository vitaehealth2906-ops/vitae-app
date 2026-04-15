const OpenAI = require('openai');
const https = require('https');
const http = require('http');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Download a file from URL and return as Buffer
 */
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Transcribe audio from a URL using OpenAI Whisper
 * @param {string} audioUrl - Public URL of the audio file
 * @returns {string} Transcribed text
 */
async function transcreverAudio(audioUrl) {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[TRANSCRIPTION] OPENAI_API_KEY not set, skipping transcription');
    return null;
  }

  try {
    console.log('[TRANSCRIPTION] Downloading audio from:', audioUrl);
    const audioBuffer = await downloadFile(audioUrl);
    console.log('[TRANSCRIPTION] Audio size:', audioBuffer.length, 'bytes');

    // Detect format from URL extension
    const ext = audioUrl.match(/\.(webm|mp4|ogg|wav|m4a)/) ? audioUrl.match(/\.(webm|mp4|ogg|wav|m4a)/)[1] : 'webm';
    const mimeMap = { webm: 'audio/webm', mp4: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4' };
    const file = new File([audioBuffer], `audio.${ext}`, { type: mimeMap[ext] || 'audio/webm' });

    console.log('[TRANSCRIPTION] Sending to Whisper...');
    const response = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: file,
      language: 'pt',
    });

    console.log('[TRANSCRIPTION] Success! Text length:', response.text.length);
    return response.text;
  } catch (err) {
    console.error('[TRANSCRIPTION] Error:', err.message);
    return null;
  }
}

/**
 * Transcribe audio from a URL using OpenAI Whisper with WORD-level timestamps.
 * Retorna { text, words: [{ word, start, end }] } para karaoke sync no frontend.
 * @param {string} audioUrl - Public URL of the audio file
 * @returns {{ text: string, words: Array<{word: string, start: number, end: number}> } | null}
 */
async function transcreverAudioComTimestamps(audioUrl) {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[TRANSCRIPTION-TS] OPENAI_API_KEY not set');
    return null;
  }

  try {
    console.log('[TRANSCRIPTION-TS] Downloading audio from:', audioUrl);
    const audioBuffer = await downloadFile(audioUrl);
    console.log('[TRANSCRIPTION-TS] Audio size:', audioBuffer.length, 'bytes');

    const ext = audioUrl.match(/\.(webm|mp4|ogg|wav|m4a)/) ? audioUrl.match(/\.(webm|mp4|ogg|wav|m4a)/)[1] : 'webm';
    const mimeMap = { webm: 'audio/webm', mp4: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4' };
    const file = new File([audioBuffer], `audio.${ext}`, { type: mimeMap[ext] || 'audio/webm' });

    console.log('[TRANSCRIPTION-TS] Pedindo Whisper com word-level timestamps...');
    // response_format "verbose_json" + timestamp_granularities=["word"] retorna words array
    const response = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: file,
      language: 'pt',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    });

    const words = Array.isArray(response.words)
      ? response.words.map(w => ({ word: w.word, start: w.start, end: w.end }))
      : [];
    console.log('[TRANSCRIPTION-TS] Success! Text:', response.text.length, 'chars |', words.length, 'words com timestamps');

    return { text: response.text, words: words };
  } catch (err) {
    console.error('[TRANSCRIPTION-TS] Error:', err.message);
    return null;
  }
}

module.exports = { transcreverAudio, transcreverAudioComTimestamps };

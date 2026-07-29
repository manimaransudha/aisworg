import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const express = require('express');
const router  = express.Router();

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { appConfig } from '../../config/appconfig.js';
import { logger }    from '../../utils/logger.js';

/**
 * // GET /finanaly/demo/voice-config — current demo voice settings
 * GET /aisworg/demo/voice-config — current demo voice settings
 */
router.get('/voice-config', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    provider: appConfig.get('demo.voice_provider', 'webspeech'),
    voice:    appConfig.get('demo.edgetts_voice',  'en-IN-NeerjaNeural'),
  });
});

/**
 * // POST /finanaly/demo/tts — synthesise text via Edge TTS, return MP3
 * POST /aisworg/demo/tts — synthesise text via Edge TTS, return MP3
 */
router.post('/tts', async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });

  const voice = appConfig.get('demo.edgetts_voice', 'en-IN-NeerjaNeural');

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = await tts.toStream(text.trim());  // v2: returns Promise<{audioStream, metadataStream}>

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');

    const chunks = [];
    audioStream.on('data',  chunk => chunks.push(chunk));
    audioStream.on('end',   ()    => res.send(Buffer.concat(chunks)));
    audioStream.on('error', err  => {
      logger.error('[DemoTTS] Edge TTS stream error:', err.message);
      if (!res.headersSent) res.status(502).json({ error: 'Edge TTS failed: ' + err.message });
    });
  } catch (err) {
    logger.error('[DemoTTS] Edge TTS error:', err.message);
    res.status(502).json({ error: 'Edge TTS failed: ' + err.message });
  }
});

export { router };

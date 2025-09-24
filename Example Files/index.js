import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = process.env.PORT ?? 3010;
const voice = process.env.OPENAI_VOICE ?? 'verse';
const model = process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime';
const instructions = process.env.OPENAI_AGENT_INSTRUCTIONS ?? 'You are a helpful voice assistant.';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/token', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    return;
  }

  const sessionConfig = {
    session: {
      type: 'realtime',
      model,
      instructions,
      // Request audio output; transcripts stream via output_audio_transcript events.
      output_modalities: ['audio'],
      audio: {
        output: {
          voice,
        },
      },
    },
  };

  try {
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionConfig),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Failed to create ephemeral key', response.status, errText);
      res.status(response.status).json({ error: 'Failed to create ephemeral key', details: errText });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Token endpoint error', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Voice agent server listening on http://localhost:${port}`);
});

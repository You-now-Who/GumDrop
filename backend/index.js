// server/index.js
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_KEY;
const LITEAPI_KEY = process.env.LITEAPI_KEY;

// Proxy to LiteAPI (replace URL with actual liteapi URL)
app.post('/api/hotels', async (req, res) => {
  const { location, checkin, nights } = req.body;
  try {
    const r = await fetch('https://api.liteexample.com/hotels/search', { // replace
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LITEAPI_KEY}`
      },
      body: JSON.stringify({ location, checkin, nights })
    });
    const j = await r.json();
    res.json(j);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Proxy to OpenAI for LLM summarization
app.post('/api/ai', async (req, res) => {
  const { prompt } = req.body;
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // replace if desired
        messages: [{ role: 'system', content: 'You are a travel concierge.' }, { role: 'user', content: prompt }],
        max_tokens: 300
      })
    });
    const j = await r.json();
    res.json(j);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port', PORT));

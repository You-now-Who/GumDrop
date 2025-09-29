// server/index.js
import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_KEY;
const LITEAPI_KEY = process.env.LITEAPI_KEY;
const GEOCODING_KEY = process.env.GEOCODING_KEY;

// Proxy to LiteAPI (replace URL with actual liteapi URL)
app.post('/api/hotels', async (req, res) => {
  const { location, radius } = req.body;
  try {

    // Fetches the Lat and Lon from the location
    const geoRes = await fetch("http://localhost:3000/api/geolocate", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location })
    });
    const { lat, lon } = await geoRes.json();

    // Fetches the hotels in the radius from the lat and long
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      radius: radius
    }).toString();

    const url = `https://api.liteapi.travel/v3.0/data/hotels?${params}`;
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'X-API-Key': `${LITEAPI_KEY}`
      }
    };
    
    const r = await fetch(url, options);
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

app.post('/api/geolocate', async (req, res) => {
  const { location } = req.body;

  const url = `https://geocode.maps.co/search?q=${location}&api_key=${GEOCODING_KEY}`;
  const r = await fetch(url);
  const j = await r.json();

  const lat = j[0].lat;
  const lon = j[0].lon;

  // console.log(j);
  res.json({lat, lon});

});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port', PORT));

// server/index.js
import "dotenv/config";
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_KEY;
const LITEAPI_KEY = process.env.LITEAPI_KEY;
const GEOCODING_KEY = process.env.GEOCODING_KEY;

// Gets list of available hotels
app.post("/api/hotels", async (req, res) => {
  const { location, radius } = req.body;
  try {
    // Fetches the Lat and Lon from the location
    const geoRes = await fetch("http://localhost:3000/api/geolocate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location }),
    });
    const { lat, lon } = await geoRes.json();

    // Fetches the hotels in the radius from the lat and long
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      radius: radius,
    }).toString();

    const url = `https://api.liteapi.travel/v3.0/data/hotels?${params}`;
    const options = {
      method: "GET",
      headers: {
        accept: "application/json",
        "X-API-Key": `${LITEAPI_KEY}`,
      },
    };

    const r = await fetch(url, options);
    const j = await r.json();
    res.json(j);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/hotels_details", async (req, res) => {
  
  // Get the request details
  const { hotelIds, eventDate } = req.body;
  console.log(hotelIds);

  // Parse the eventDate string (e.g., "Saturday, October 4")
  const [_, monthDay] = eventDate.split(", ");
  const [month, day] = monthDay.split(" ");
  const year = new Date().getFullYear(); // Use current year or adjust as needed

  // Create a Date object for the event
  const event = new Date(`${month} ${day}, ${year}`);

  // Calculate checkin (day before) and checkout (day after)
  const checkinDate = new Date(event);
  checkinDate.setDate(event.getDate() - 1);

  const checkoutDate = new Date(event);
  checkoutDate.setDate(event.getDate() + 1);

  // Format as YYYY-MM-DD (API expects this format)
  const formatDate = d => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const checkin = formatDate(checkinDate);
  const checkout = formatDate(checkoutDate);


  const url = "https://api.liteapi.travel/v3.0/hotels/rates";
  const options = {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "X-API-Key": LITEAPI_KEY,
    },
    body: JSON.stringify({
      hotelIds: ["lp658091ac", "lp656cdbd1"],
      occupancies: [{ adults: 1 }],
      currency: "GBP",
      guestNationality: "IN",
      checkin: "2025-11-01",
      checkout: "2025-11-02",
    }),
  };

  res.json({Hi: "hi"});
});

// Proxy to OpenAI for LLM summarization
app.post("/api/ai", async (req, res) => {
  const { prompt } = req.body;
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // replace if desired
        messages: [
          { role: "system", content: "You are a travel concierge." },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
      }),
    });
    const j = await r.json();
    res.json(j);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/geolocate", async (req, res) => {
  const { location } = req.body;

  const url = `https://geocode.maps.co/search?q=${location}&api_key=${GEOCODING_KEY}`;
  const r = await fetch(url);
  const j = await r.json();

  const lat = j[0].lat;
  const lon = j[0].lon;

  // console.log(j);
  res.json({ lat, lon });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));

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
  const { location, address, radius } = req.body;
  try {
    // Fetches the Lat and Lon from the location
    const geoRes = await fetch("http://localhost:3000/api/geolocate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location, address }),
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
      hotelIds: hotelIds,
      occupancies: [{ adults: 1 }],
      currency: "GBP",
      guestNationality: "IN",
      checkin: checkin,
      checkout: checkout,
    }),
  };

  const r = await fetch(url, options);
  const j = await r.json();
  j.checkin = checkin;
  j.checkout = checkout;
  res.json(j);

});

// Prebook a hotel room
app.post("/api/prebook", async (req, res) => {
  const { offerId } = req.body;
  
  try {
    const url = "https://api.liteapi.travel/v3.0/rates/prebook";
    const options = {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "X-API-Key": LITEAPI_KEY,
      },
      body: JSON.stringify({usePaymentSdk: false, offerId: offerId})
    };

    const r = await fetch(url, options);
    const j = await r.json();
    
    if (!r.ok) {
      return res.status(r.status).json({ error: j.message || "Prebook failed", details: j });
    }
    
    res.json(j);
  } catch (err) {
    console.error("Prebook error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// Complete hotel booking
app.post("/api/book", async (req, res) => {
  const { holder, payment, guests, prebookId, guestPayment } = req.body;
  
  console.log("Booking request received:", { holder, guestPayment, payment, guests, prebookId });
  
  try {
    // Validate API key first
    if (!LITEAPI_KEY) {
      return res.status(500).json({ error: "LITEAPI_KEY not configured" });
    }
    
    // Validate required fields
    if (!holder || !guests || !prebookId) {
      return res.status(400).json({ 
        error: "Missing required fields", 
        required: ["holder", "guests", "prebookId"] 
      });
    }
    
    if (!holder.firstName || !holder.lastName || !holder.email || !holder.phone) {
      return res.status(400).json({ 
        error: "Holder information incomplete", 
        required: ["firstName", "lastName", "email", "phone"] 
      });
    }
    
    if (!Array.isArray(guests) || guests.length === 0) {
      return res.status(400).json({ error: "At least one guest is required" });
    }
    
    const url = "https://book.liteapi.travel/v3.0/rates/book";
    
    let bookingBody = {
        holder: holder,
        guestPayment: guestPayment,
        payment: payment,
        guests: guests,
        prebookId: prebookId
      };
    
    const options = {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "X-API-Key": LITEAPI_KEY,
      },
      body: JSON.stringify(bookingBody),
    };

    // console.log("Sending to LiteAPI:", JSON.stringify(options.body, null, 2));

    console.log("Making request to:", url);
    console.log("Request options:", JSON.stringify(options, null, 2));
    
    const r = await fetch(url, options);
    console.log("Response status:", r.status);
    console.log("Response headers:", Object.fromEntries(r.headers));
    
    const responseText = await r.text();
    console.log("Raw response body:", responseText);
    console.log("Response body length:", responseText.length);
    
    if (!responseText || responseText.trim() === '') {
      console.log("Empty response detected!");
      return res.status(500).json({ 
        error: "Empty response from API", 
        status: r.status,
        headers: Object.fromEntries(r.headers)
      });
    }
    
    let j;
    try {
      j = JSON.parse(responseText);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return res.status(500).json({ error: "Invalid JSON response from API", raw: responseText });
    }
    
    console.log("LiteAPI Response:", j);
    if (!r.ok) {
      return res.status(r.status).json({ error: j.message || "Booking failed", details: j });
    }
    
    // Include our booking metadata in the response
    const bookingResponse = {
      ...j,
      bookingMeta: {
        holder: holder,
        guests: guests,
        payment: payment,
        gumDropBookingId: "GD" + Date.now().toString(36).toUpperCase()
      }
    };
    
    res.json(bookingResponse);
  } catch (err) {
    console.error("Booking error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// AI Hotel Recommendations
app.post("/api/ai/hotels", async (req, res) => {
  const { hotels, eventDetails } = req.body;
  try {
    const hotelPrompt = `
You are a travel expert AI. Analyze these hotels and categorize the top 3 for different use cases. 

Event Details: ${eventDetails?.title || 'Event'} on ${eventDetails?.date || 'Unknown Date'} at ${eventDetails?.location || 'Unknown Location'}

Hotels Data:
${hotels.map((hotel, i) => `
${i + 1}. ${hotel.name} - ${hotel.address}
   - Rating: ${hotel.rating || 'N/A'} stars
   - Price: ${hotel.pricing ? `${hotel.pricing.currency} ${hotel.pricing.amount}` : 'Price not available'}
   - Distance: ${hotel.distance ? `${hotel.distance.toFixed(1)}km` : 'Distance unknown'}
   - Room Type: ${hotel.pricing?.boardName || 'Standard Room'}
`).join('')}

Please analyze and return ONLY a JSON object with exactly this structure (no other text):
{
  "bestBudget": { "index": 0, "reason": "Brief reason why this is best budget option" },
  "mostLuxurious": { "index": 1, "reason": "Brief reason why this is most luxurious" },
  "bestOverall": { "index": 2, "reason": "Brief reason why this is best overall value" }
}

Consider factors like price, rating, location proximity to event, room amenities, and value for money. Each category should have a different hotel (use different indices).`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: "You are a travel expert that provides JSON responses for hotel recommendations. Always respond with valid JSON only." 
          },
          { role: "user", content: hotelPrompt },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });
    
    const aiResponse = await r.json();
    
    if (aiResponse.choices && aiResponse.choices[0]?.message?.content) {
      try {
        const recommendations = JSON.parse(aiResponse.choices[0].message.content);
        res.json({ success: true, recommendations });
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError);
        // Fallback to simple categorization
        res.json({
          success: true,
          recommendations: {
            bestBudget: { index: 0, reason: "Most affordable option available" },
            mostLuxurious: { index: Math.min(1, hotels.length - 1), reason: "Premium accommodation with excellent amenities" },
            bestOverall: { index: Math.min(2, hotels.length - 1), reason: "Perfect balance of price, location, and quality" }
          }
        });
      }
    } else {
      throw new Error("Invalid AI response");
    }
  } catch (err) {
    console.error("AI hotel recommendation error:", err);
    res.status(500).json({ error: String(err) });
  }
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
  const { location, address } = req.body;

  const url = `https://geocode.maps.co/search?q=${location}&api_key=${GEOCODING_KEY}`;
  const r = await fetch(url);
  const rawText = await r.text();
  console.log(rawText);

  let j;
  try {
    j = JSON.parse(rawText);
    // If no results, try with address
    if (!Array.isArray(j) || j.length === 0) {
      const url2 = `https://geocode.maps.co/search?q=${address}&api_key=${GEOCODING_KEY}`;
      const r2 = await fetch(url2);
      const rawText2 = await r2.text();
      try {
        j = JSON.parse(rawText2);
      } catch (err) {
        return res.status(500).json({ error: "Response is not valid JSON", raw: rawText2 });
      }
      if (!Array.isArray(j) || j.length === 0) {
        return res.status(404).json({ error: "No geocoding results found for location or address." });
      }
    }
  } catch (err) {
    return res.status(500).json({ error: "Response is not valid JSON", raw: rawText });
  }

  const lat = j[0].lat;
  const lon = j[0].lon;

  // console.log(j);
  res.json({ lat, lon });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));

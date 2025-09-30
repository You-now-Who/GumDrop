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
      body: JSON.stringify({usePaymentSdk: true, offerId: offerId})
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
  const { holder, payment, guests, prebookId } = req.body;
  
  console.log("Booking request received:", { holder, payment, guests, prebookId });
  
  try {
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
    
    // Use primary guest for LiteAPI guestInfo (API expects single guest format)
    const primaryGuest = guests[0];
    
    const url = "https://api.liteapi.travel/v3.0/hotels/rates/book";
    const options = {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "X-API-Key": LITEAPI_KEY,
      },
      body: JSON.stringify({
        prebookId: prebookId,
        guestInfo: {
          guestFirstName: primaryGuest.firstName,
          guestLastName: primaryGuest.lastName,
          guestEmail: primaryGuest.email,
          guestPhoneNumber: primaryGuest.phone
        },
        paymentMethod: payment?.method === "TRANSACTION_ID" ? "NUITEE_PAY" : "PROPERTY_PAY",
        holderName: `${holder.firstName} ${holder.lastName}`,
        paymentMethodId: payment?.transactionId || "pm_gumdrop_" + Math.random().toString(36).substr(2, 12)
      }),
    };

    console.log("Sending to LiteAPI:", JSON.stringify(options.body, null, 2));

    const r = await fetch(url, options);
    const j = await r.json();
    
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

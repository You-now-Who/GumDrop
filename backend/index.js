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

// Payment data storage (use Redis/Database in production)
const paymentDataStore = {};

// Serve payment page (avoids CSP issues)
app.get("/payment", (req, res) => {
  const { data } = req.query;
  
  const paymentHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gumdrop - Secure Payment</title>
  <script src="https://payment-wrapper.liteapi.travel/dist/liteAPIPayment.js?v=a1"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
</head>
<body class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 font-inter">
  
  <div class="max-w-2xl mx-auto p-6">
    <!-- Header -->
    <div class="bg-white shadow-sm border border-slate-200 rounded-2xl p-6 mb-6">
      <div class="flex items-center space-x-4">
        <div class="w-10 h-10 bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-400 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <div>
          <h1 class="text-xl font-black text-slate-800">Gumdrop Payment</h1>
          <p class="text-sm text-slate-600">Secure payment powered by LiteAPI</p>
        </div>
      </div>
    </div>

    <!-- Booking Summary -->
    <div class="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6" id="booking-summary" style="display:none;">
      <h2 class="text-lg font-bold text-slate-800 mb-4">Booking Summary</h2>
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p class="text-slate-500 font-medium">Hotel</p>
          <p class="font-semibold text-slate-800" id="hotel-name">Loading...</p>
        </div>
        <div>
          <p class="text-slate-500 font-medium">Guest</p>
          <p class="font-semibold text-slate-800" id="guest-name">Loading...</p>
        </div>
        <div>
          <p class="text-slate-500 font-medium">Room Type</p>
          <p class="font-semibold text-slate-800" id="room-name">Loading...</p>
        </div>
        <div>
          <p class="text-slate-500 font-medium">Total Amount</p>
          <p class="font-bold text-xl text-green-600" id="total-price">Loading...</p>
        </div>
      </div>
    </div>
    
    <!-- Payment Form -->
    <div class="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
      <h2 class="text-lg font-bold text-slate-800 mb-6 flex items-center">
        <svg class="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
        </svg>
        Secure Payment
      </h2>
      
      <div id="payment-loading" class="text-center py-8">
        <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-slate-600">Initializing secure payment...</p>
      </div>
      
      <div id="targetElement"></div>
      
      <div id="payment-error" class="hidden text-center py-8">
        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <p class="text-red-600 font-medium">Payment initialization failed</p>
        <p class="text-slate-600 text-sm mt-2">Please close this window and try again.</p>
      </div>
    </div>

    <!-- Security Notice -->
    <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
      <div class="flex items-start space-x-3">
        <svg class="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
        <div>
          <h4 class="font-semibold text-blue-900 text-sm">Secure Payment</h4>
          <p class="text-blue-800 text-xs mt-1">Your payment is processed securely. We do not store your card details.</p>
          <p class="text-blue-700 text-xs mt-2 font-medium">💳 For testing, use card: 4242424242424242</p>
        </div>
      </div>
    </div>
  </div>

  <script>
    const urlParams = new URLSearchParams(window.location.search);
    const paymentDataKey = urlParams.get('data');
    
    if (paymentDataKey) {
      fetch('/api/payment-data/' + paymentDataKey)
        .then(r => r.json())
        .then(paymentData => {
          console.log('Payment data loaded:', paymentData);
          
          // Populate booking summary
          const summary = paymentData.bookingSummary;
          if (summary) {
            document.getElementById('hotel-name').textContent = summary.hotelName || 'Hotel';
            document.getElementById('guest-name').textContent = summary.guestName || 'Guest';
            document.getElementById('room-name').textContent = summary.roomName || 'Room';
            document.getElementById('total-price').textContent = (summary.currency === 'USD' ? '$' : '£') + (summary.totalPrice || 0).toFixed(2);
            document.getElementById('booking-summary').style.display = 'block';
          }
          
          const { secretKey, transactionId, prebookId } = paymentData;
          
          if (!secretKey || !transactionId) {
            throw new Error('Missing payment credentials');
          }
          
          // Store booking data for completion
          fetch('/api/store-booking-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transactionId: transactionId,
              bookingData: paymentData.bookingFormData,
              prebookId: prebookId
            })
          });
          
          const isLive = !secretKey.includes('test') && !secretKey.includes('sandbox');
          const returnUrl = window.location.origin + '/payment-complete?tid=' + transactionId + '&pid=' + prebookId;
          
          const liteAPIConfig = {
            publicKey: isLive ? 'live' : 'sandbox',
            appearance: { theme: 'flat' },
            options: { business: { name: 'Gumdrop Travel' } },
            targetElement: '#targetElement',
            secretKey: secretKey,
            returnUrl: returnUrl,
          };
          
          document.getElementById('payment-loading').style.display = 'none';
          
          const liteAPIPayment = new LiteAPIPayment(liteAPIConfig);
          liteAPIPayment.handlePayment();
        })
        .catch(err => {
          console.error('Payment init error:', err);
          document.getElementById('payment-loading').style.display = 'none';
          document.getElementById('payment-error').style.display = 'block';
        });
    } else {
      document.getElementById('payment-loading').style.display = 'none';
      document.getElementById('payment-error').style.display = 'block';
    }
  </script>
</body>
</html>
  `;
  
  res.send(paymentHTML);
});

// Store payment data endpoint  
app.post("/api/payment-data", (req, res) => {
  const { paymentData } = req.body;
  const dataId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  paymentDataStore[dataId] = paymentData;
  
  // Auto-cleanup after 1 hour
  setTimeout(() => {
    delete paymentDataStore[dataId];
  }, 3600000);
  
  res.json({ dataId });
});

// Get payment data endpoint
app.get("/api/payment-data/:dataId", (req, res) => {
  const paymentData = paymentDataStore[req.params.dataId];
  if (paymentData) {
    res.json(paymentData);
  } else {
    res.status(404).json({ error: 'Payment data not found or expired' });
  }
});

// Store booking data for completion
app.post("/api/store-booking-data", (req, res) => {
  const { transactionId, bookingData, prebookId } = req.body;
  paymentDataStore['booking_' + transactionId] = { bookingData, prebookId };
  res.json({ success: true });
});

// Payment completion endpoint
app.get("/payment-complete", async (req, res) => {
  const { tid, pid } = req.query;
  
  try {
    const storedData = paymentDataStore['booking_' + tid];
    
    if (!storedData) {
      throw new Error('Booking data not found');
    }
    
    const { bookingData } = storedData;
    
    // Finalize booking
    const bookingResponse = await fetch('http://localhost:3000/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        holder: bookingData.holder,
        payment: { method: 'TRANSACTION_ID', transactionId: tid },
        guests: bookingData.guests,
        prebookId: pid
      })
    });
    
    if (!bookingResponse.ok) {
      throw new Error('Booking finalization failed');
    }
    
    const bookingResult = await bookingResponse.json();
    
    // Show success page
    res.send(`
      <html>
        <head>
          <title>Booking Confirmed</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-8">
          <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <div class="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-slate-800 mb-4">Booking Confirmed! 🎉</h1>
            <p class="text-slate-600 mb-6">Your reservation has been successfully created.</p>
            <div class="bg-gray-50 rounded-lg p-4 mb-6">
              <p class="text-xs text-gray-500 mb-1">Booking Reference</p>
              <p class="font-mono text-sm font-semibold">${bookingResult.bookingMeta?.gumDropBookingId || 'GD' + Date.now()}</p>
            </div>
            <button onclick="window.close()" class="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all">
              Close Window
            </button>
            <p class="text-xs text-slate-500 mt-4">A confirmation email will be sent shortly.</p>
          </div>
        </body>
      </html>
    `);
    
    // Cleanup
    delete paymentDataStore['booking_' + tid];
    delete paymentDataStore[req.query.data];
    
  } catch (error) {
    console.error('Payment completion error:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>Booking Error</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-8">
          <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <div class="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-slate-800 mb-4">Booking Failed</h1>
            <p class="text-slate-600 mb-6">Your payment was successful, but we couldn't complete the booking.</p>
            <p class="text-sm text-red-600 mb-6">${error.message}</p>
            <button onclick="window.close()" class="w-full bg-slate-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-slate-700 transition-all">
              Close Window
            </button>
          </div>
        </body>
      </html>
    `);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));

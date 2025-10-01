// This approach uses your backend to serve the payment page
// Update your backend to include a payment endpoint

app.get("/payment", (req, res) => {
  const { data } = req.query;
  
  // Serve payment HTML with embedded LiteAPI SDK
  const paymentHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gumdrop - Complete Payment</title>
  <script src="https://payment-wrapper.liteapi.travel/dist/liteAPIPayment.js?v=a1"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
</head>
<body class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 font-inter">
  
  <!-- Payment UI here -->
  <div class="max-w-2xl mx-auto p-6">
    <div class="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
      <h2 class="text-lg font-bold text-slate-800 mb-6">Secure Payment</h2>
      
      <!-- Loading State -->
      <div id="payment-loading" class="text-center py-8">
        <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-slate-600">Initializing secure payment...</p>
      </div>
      
      <!-- Payment SDK Container -->
      <div id="targetElement"></div>
    </div>
  </div>

  <script>
    // Get payment data from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const paymentDataKey = urlParams.get('data');
    
    if (paymentDataKey) {
      // Fetch payment data from your backend
      fetch('/api/payment-data/' + paymentDataKey)
        .then(r => r.json())
        .then(paymentData => {
          const { secretKey, transactionId, prebookId } = paymentData;
          
          // Determine environment
          const isLive = !secretKey.includes('test') && !secretKey.includes('sandbox');
          
          // Return URL back to your backend for completion
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
          document.getElementById('payment-loading').innerHTML = '<p class="text-red-600">Payment initialization failed</p>';
        });
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
  
  // Store temporarily (use Redis or memory store in production)
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
    res.status(404).json({ error: 'Payment data not found' });
  }
});

// Payment completion endpoint
app.get("/payment-complete", async (req, res) => {
  const { tid, pid } = req.query;
  
  try {
    // Get stored booking data
    const bookingData = paymentDataStore['booking_' + tid];
    
    if (!bookingData) {
      throw new Error('Booking data not found');
    }
    
    // Finalize booking with LiteAPI
    const bookingResult = await finalizeBooking(pid, tid, bookingData);
    
    // Show success page
    res.send(`
      <html>
        <head><title>Booking Confirmed</title></head>
        <body style="font-family: system-ui; text-align: center; padding: 2rem;">
          <h1 style="color: green;">✅ Booking Confirmed!</h1>
          <p>Booking Reference: ${bookingResult.bookingId}</p>
          <button onclick="window.close()" style="padding: 1rem 2rem; background: #3b82f6; color: white; border: none; border-radius: 8px;">Close</button>
        </body>
      </html>
    `);
    
    // Cleanup
    delete paymentDataStore['booking_' + tid];
    
  } catch (error) {
    res.status(500).send(`
      <html>
        <head><title>Booking Error</title></head>
        <body style="font-family: system-ui; text-align: center; padding: 2rem;">
          <h1 style="color: red;">❌ Booking Failed</h1>
          <p>${error.message}</p>
          <button onclick="window.close()" style="padding: 1rem 2rem; background: #6b7280; color: white; border: none; border-radius: 8px;">Close</button>
        </body>
      </html>
    `);
  }
});

const paymentDataStore = {}; // Use proper storage in production
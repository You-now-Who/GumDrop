document.addEventListener('DOMContentLoaded', async function() {
  console.log('Payment page loaded');
  
  // Get payment data from URL parameters or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const paymentDataKey = urlParams.get('data');
  
  let paymentData;
  try {
    if (paymentDataKey) {
      // Get payment data from localStorage using the key
      const storedData = localStorage.getItem(paymentDataKey);
      if (storedData) {
        paymentData = JSON.parse(storedData);
        console.log('Payment data loaded:', paymentData);
      }
    }
    
    if (!paymentData) {
      throw new Error('No payment data found');
    }
    
    // Populate booking summary
    populateBookingSummary(paymentData);
    
    // Initialize LiteAPI Payment SDK
    await initializeLiteAPIPayment(paymentData);
    
  } catch (error) {
    console.error('Payment initialization error:', error);
    showError('Failed to initialize payment. Please try again.');
  }
  
  // Close button handler
  document.getElementById('close-payment')?.addEventListener('click', () => {
    window.close();
  });
});

function populateBookingSummary(paymentData) {
  const { hotelName, roomName, guestName, totalPrice, currency } = paymentData.bookingSummary;
  
  document.getElementById('payment-hotel-name').textContent = hotelName || 'Unknown Hotel';
  document.getElementById('payment-room-name').textContent = roomName || 'Standard Room';
  document.getElementById('payment-guest-name').textContent = guestName || 'Guest';
  document.getElementById('payment-total-price').textContent = `${currency === 'USD' ? '$' : '£'}${totalPrice?.toFixed(2) || '0.00'}`;
}

async function initializeLiteAPIPayment(paymentData) {
  try {
    const { secretKey, transactionId, prebookId, bookingFormData } = paymentData;
    
    if (!secretKey || !transactionId) {
      throw new Error('Missing payment credentials');
    }
    
    // Determine environment (sandbox vs live)
    const isLive = !secretKey.includes('test') && !secretKey.includes('sandbox');
    
    // Create return URL that includes our booking data
    const returnUrl = `${window.location.origin}${window.location.pathname}?action=complete&tid=${transactionId}&pid=${prebookId}`;
    
    console.log('Initializing LiteAPI Payment with:', {
      publicKey: isLive ? 'live' : 'sandbox',
      secretKey: secretKey,
      transactionId: transactionId,
      returnUrl: returnUrl
    });
    
    // LiteAPI Payment configuration
    const liteAPIConfig = {
      publicKey: isLive ? 'live' : 'sandbox',
      appearance: {
        theme: 'flat',
      },
      options: {
        business: {
          name: 'Gumdrop Travel',
        },
      },
      targetElement: '#targetElement',
      secretKey: secretKey,
      returnUrl: returnUrl,
    };
    
    // Store booking data for return flow
    localStorage.setItem(`booking_${transactionId}`, JSON.stringify({
      prebookId: prebookId,
      bookingFormData: bookingFormData,
      transactionId: transactionId
    }));
    
    // Hide loading, show payment form
    document.getElementById('payment-loading').classList.add('hidden');
    document.getElementById('targetElement').classList.remove('hidden');
    
    // Initialize LiteAPI Payment SDK
    const liteAPIPayment = new LiteAPIPayment(liteAPIConfig);
    liteAPIPayment.handlePayment();
    
  } catch (error) {
    console.error('LiteAPI Payment initialization error:', error);
    showError('Payment initialization failed. Please try again.');
  }
}

function showError(message) {
  document.getElementById('payment-loading').classList.add('hidden');
  document.getElementById('targetElement').classList.add('hidden');
  document.getElementById('payment-error').classList.remove('hidden');
  
  const errorElement = document.querySelector('#payment-error p');
  if (errorElement) {
    errorElement.textContent = message;
  }
}

// Handle return from payment (when redirected back after successful payment)
async function handlePaymentReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action');
  const transactionId = urlParams.get('tid');
  const prebookId = urlParams.get('pid');
  
  if (action === 'complete' && transactionId && prebookId) {
    console.log('Payment completed, finalizing booking...', { transactionId, prebookId });
    
    try {
      // Get stored booking data
      const bookingDataStr = localStorage.getItem(`booking_${transactionId}`);
      if (!bookingDataStr) {
        throw new Error('Booking data not found');
      }
      
      const bookingData = JSON.parse(bookingDataStr);
      
      // Show processing state
      document.body.innerHTML = `
        <div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50 font-inter flex items-center justify-center p-8">
          <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <div class="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg class="w-8 h-8 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 class="text-2xl font-bold text-slate-800 mb-4">Payment Successful!</h2>
            <p class="text-slate-600 mb-6">Finalizing your booking...</p>
            <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      `;
      
      // Finalize booking with backend
      const finalBookingResponse = await fetch('http://localhost:3000/api/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          holder: bookingData.bookingFormData.holder,
          payment: {
            method: 'TRANSACTION_ID',
            transactionId: transactionId
          },
          guests: bookingData.bookingFormData.guests,
          prebookId: prebookId
        })
      });
      
      if (!finalBookingResponse.ok) {
        throw new Error(`Final booking failed: ${finalBookingResponse.status}`);
      }
      
      const bookingResult = await finalBookingResponse.json();
      console.log('Booking finalized:', bookingResult);
      
      // Show success message
      document.body.innerHTML = `
        <div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50 font-inter flex items-center justify-center p-8">
          <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <div class="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 class="text-2xl font-bold text-slate-800 mb-4">Booking Confirmed! 🎉</h2>
            <p class="text-slate-600 mb-4">Your reservation has been successfully created.</p>
            <div class="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <p class="text-xs text-gray-500 mb-1">Booking Reference</p>
              <p class="font-mono text-sm font-semibold text-gray-800">${bookingResult.bookingMeta?.gumDropBookingId || bookingResult.data?.bookingId || 'GD' + Date.now()}</p>
            </div>
            <button onclick="window.close()" class="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all">
              Close
            </button>
            <p class="text-xs text-slate-500 mt-4">A confirmation email will be sent to you shortly.</p>
          </div>
        </div>
      `;
      
      // Clean up stored data
      localStorage.removeItem(`booking_${transactionId}`);
      
      // Auto-close after delay
      setTimeout(() => {
        window.close();
      }, 10000);
      
    } catch (error) {
      console.error('Final booking error:', error);
      
      // Show error message
      document.body.innerHTML = `
        <div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50 font-inter flex items-center justify-center p-8">
          <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <div class="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h2 class="text-2xl font-bold text-slate-800 mb-4">Booking Failed</h2>
            <p class="text-slate-600 mb-6">Your payment was successful, but we couldn't complete the booking. Please contact support.</p>
            <button onclick="window.close()" class="w-full bg-slate-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-slate-700 transition-all">
              Close
            </button>
          </div>
        </div>
      `;
    }
  }
}

// Check if this is a return from payment
if (window.location.search.includes('action=complete')) {
  handlePaymentReturn();
}
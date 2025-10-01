document.addEventListener('DOMContentLoaded', async function() {
  // Notification System
  function showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    const notificationId = 'notification_' + Date.now();
    notification.id = notificationId;
    
    // Style based on type
    let bgColor, textColor, icon;
    switch (type) {
      case 'error':
        bgColor = 'bg-red-100 border-red-300';
        textColor = 'text-red-800';
        icon = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>';
        break;
      case 'success':
        bgColor = 'bg-green-100 border-green-300';
        textColor = 'text-green-800';
        icon = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>';
        break;
      case 'warning':
        bgColor = 'bg-yellow-100 border-yellow-300';
        textColor = 'text-yellow-800';
        icon = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>';
        break;
      default:
        bgColor = 'bg-blue-100 border-blue-300';
        textColor = 'text-blue-800';
        icon = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>';
    }

    notification.className = `${bgColor} ${textColor} border rounded-lg p-3 shadow-lg transform translate-y-0 opacity-100 transition-all duration-300 ease-in-out`;
    notification.innerHTML = `
      <div class="flex items-center space-x-2">
        <div class="flex-shrink-0">${icon}</div>
        <div class="flex-1 text-sm font-medium">${message}</div>
        <button class="flex-shrink-0 ml-2 text-current opacity-70 hover:opacity-100" onclick="hideNotification('${notificationId}')">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
        </button>
      </div>
    `;

    container.appendChild(notification);

    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => hideNotification(notificationId), duration);
    }
  }

  // Global function to hide notifications
  window.hideNotification = function(notificationId) {
    const notification = document.getElementById(notificationId);
    if (notification) {
      notification.style.transform = 'translateY(-100%)';
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  };

  // Check if user has completed setup
  try {
    const storage = await chrome.storage.local.get(['setupCompleted', 'setupSkipped']);
    console.log('Popup setup check:', storage);
    
    if (!storage.setupCompleted && !storage.setupSkipped) {
      // Redirect to setup page
      console.log('Redirecting to setup page');
      chrome.tabs.create({ url: chrome.runtime.getURL('setup.html') });
      window.close();
      return;
    }
  } catch (error) {
    console.error('Error checking setup status:', error);
  }

  // Load and display user name
  loadUserName();

  const generateBtn = document.getElementById('generate-btn');
  const loadingDiv = document.getElementById('loading');
  const noEventDiv = document.getElementById('no-event');
  const eventDetailsDiv = document.getElementById('event-details');
  const hotelsSection = document.getElementById('hotels-section');
  const hotelsStack = document.getElementById('hotels-stack');
  const hotelsCount = document.getElementById('hotels-count');
  
  const eventTitle = document.getElementById('event-title');
  const eventDate = document.getElementById('event-date');
  const eventLocation = document.getElementById('event-location');

  let currentEventData = null;
  let currentRadius = 3000; // Default 3km

  // Format date to readable format
  function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

  // Get user profile data
  async function getUserProfile() {
    try {
      const storage = await chrome.storage.local.get(['userProfile']);
      return storage.userProfile || {
        firstName: "Guest",
        lastName: "User",
        email: "guest@gumdrop.com",
        phone: "+1234567890"
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return {
        firstName: "Guest",
        lastName: "User", 
        email: "guest@gumdrop.com",
        phone: "+1234567890"
      };
    }
  }

  // Load and display user name
  async function loadUserName() {
    try {
      const userProfile = await getUserProfile();
      const userNameElement = document.getElementById('user-name');
      
      if (userNameElement) {
        // Display first name, or "Guest" if no profile
        const displayName = userProfile.firstName || "Guest";
        userNameElement.textContent = displayName;
      }
    } catch (error) {
      console.error('Error loading user name:', error);
      const userNameElement = document.getElementById('user-name');
      if (userNameElement) {
        userNameElement.textContent = "Guest";
      }
    }
  }

  // Setup radius filter
  function setupRadiusFilter() {
    const radiusSlider = document.getElementById('radius-slider');
    const radiusValue = document.getElementById('radius-value');
    
    if (radiusSlider && radiusValue) {
      radiusSlider.addEventListener('input', function() {
        currentRadius = parseInt(this.value);
        const kmValue = (currentRadius / 1000).toFixed(1);
        radiusValue.textContent = kmValue + 'km';
      });
      
      // Initialize display
      const initialKm = (currentRadius / 1000).toFixed(1);
      radiusValue.textContent = initialKm + 'km';
    }
  }

  // Update API status indicator
  function updateApiStatus(status) {
    const apiStatus = document.getElementById('api-status');
    if (!apiStatus) return;
    
    if (status === 'connected') {
      apiStatus.innerHTML = `
        <div class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
        <span class="text-xs text-green-600 font-medium">Live API</span>
      `;
    } else if (status === 'offline') {
      apiStatus.innerHTML = `
        <div class="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
        <span class="text-xs text-orange-600 font-medium">Demo Mode</span>
      `;
    } else {
      apiStatus.innerHTML = `
        <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse"></div>
        <span class="text-xs text-slate-400">Checking...</span>
      `;
    }
  }

  // Check API connectivity on startup
  async function checkApiStatus() {
    try {
      const response = await fetch('http://localhost:3000/api/geolocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: 'London' })
      });
      
      if (response.ok) {
        updateApiStatus('connected');
      } else {
        updateApiStatus('offline');
      }
    } catch (error) {
      updateApiStatus('offline');
    }
  }

  // Check if we're on an Eventbrite page and get fresh data
  async function loadEventData() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab.url.includes('eventbrite.com') && !currentTab.url.includes('eventbrite.co.uk')) {
        showNoEvent();
        return;
      }

      // Always get fresh data from content script
      showLoading();
      try {
        const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'getEventData' });
        
        if (response && response.eventData && response.eventData.title) {
          displayEventData(response.eventData);
        } else {
          // Trigger scraping and get data
          await chrome.tabs.sendMessage(currentTab.id, { action: 'scrapeEvent' });
          // Wait a bit and ask again
          setTimeout(async () => {
            try {
              const newResponse = await chrome.tabs.sendMessage(currentTab.id, { action: 'getEventData' });
              if (newResponse && newResponse.eventData && newResponse.eventData.title) {
                displayEventData(newResponse.eventData);
              } else {
                showNoEvent();
              }
            } catch (error) {
              console.log('Failed to get scraped data:', error);
              showNoEvent();
            }
          }, 1000);
        }
      } catch (error) {
        console.log('Content script not ready or page not supported');
        showNoEvent();
      }
    } catch (error) {
      console.error('Error loading event data:', error);
      showNoEvent();
    }
  }

  function showLoading() {
    loadingDiv.classList.remove('hidden');
    noEventDiv.classList.add('hidden');
    eventDetailsDiv.classList.add('hidden');
  }

  function showNoEvent() {
    loadingDiv.classList.add('hidden');
    noEventDiv.classList.remove('hidden');
    eventDetailsDiv.classList.add('hidden');
    
    // Allow demo mode - don't disable the generate button
    generateBtn.disabled = false;
    generateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    
    // Set demo event data for testing
    currentEventData = {
      title: "Demo Event - Tech Conference 2024",
      date: "Dec 15, 2024",
      location: "London, UK",
      ticketPrice: 45,
      currency: "£"
    };
    
    // Show cost estimate for demo
    displayCostEstimate(currentEventData);
  }

  function displayEventData(eventData) {
    loadingDiv.classList.add('hidden');
    noEventDiv.classList.add('hidden');
    eventDetailsDiv.classList.remove('hidden');
    
    currentEventData = eventData;
    eventTitle.textContent = eventData.title || 'Event Title Not Found';
    eventDate.textContent = eventData.date || 'Date Not Found';
    eventLocation.textContent = eventData.location || 'Location Not Found';
    
    // Show cost estimate if we have ticket price data
    displayCostEstimate(eventData);
    
    generateBtn.disabled = false;
    generateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  }

  function displayCostEstimate(eventData) {
    const costEstimateDiv = document.getElementById('cost-estimate');
    const eventPriceEl = document.getElementById('event-price');
    const hotelPriceEl = document.getElementById('hotel-price');
    const totalCostEl = document.getElementById('total-cost');
    
    if (!costEstimateDiv || !eventPriceEl || !hotelPriceEl || !totalCostEl) return;
    
    // Check if we have ticket price data
    if (eventData.ticketPrice !== undefined && eventData.ticketPrice !== null) {
      const currency = eventData.currency || '£';
      
      if (eventData.ticketPrice === 0) {
        eventPriceEl.textContent = 'Free';
      } else {
        eventPriceEl.textContent = `${currency}${eventData.ticketPrice}`;
      }
      
      // Store for later use when hotels are loaded
      window.currentTicketPrice = eventData.ticketPrice;
      window.currentCurrency = currency;
      
      // Show the cost estimate section
      costEstimateDiv.classList.remove('hidden');
      
      // Initially show just the event price
      hotelPriceEl.textContent = 'Finding hotels...';
      if (eventData.ticketPrice === 0) {
        totalCostEl.textContent = 'Hotel cost only';
      } else {
        totalCostEl.textContent = `${currency}${eventData.ticketPrice}+`;
      }
    } else {
      // Hide cost estimate if no price data
      costEstimateDiv.classList.add('hidden');
    }
  }

  function updateCostEstimateWithHotels(hotels) {
    const costEstimateDiv = document.getElementById('cost-estimate');
    const hotelPriceEl = document.getElementById('hotel-price');
    const totalCostEl = document.getElementById('total-cost');
    
    if (!costEstimateDiv || !hotelPriceEl || !totalCostEl) return;
    
    // Find the cheapest hotel
    let cheapestHotel = null;
    let cheapestPrice = Infinity;
    
    hotels.forEach(hotel => {
      if (hotel.pricing && hotel.pricing.amount < cheapestPrice) {
        cheapestPrice = hotel.pricing.amount;
        cheapestHotel = hotel;
      }
    });
    
    if (cheapestHotel) {
      const currency = cheapestHotel.pricing.currency === 'GBP' ? '£' : 
                     cheapestHotel.pricing.currency === 'USD' ? '$' : 
                     cheapestHotel.pricing.currency === 'EUR' ? '€' : 
                     cheapestHotel.pricing.currency;
      
      const hotelPrice = cheapestPrice;
      hotelPriceEl.textContent = `${currency}${hotelPrice}`;
      
      // Calculate total if we have event price data
      const ticketPrice = window.currentTicketPrice;
      const eventCurrency = window.currentCurrency || currency;
      
      if (ticketPrice !== undefined && ticketPrice !== null) {
        let totalPrice;
        let displayCurrency;
        
        // If currencies match, add them directly
        if (eventCurrency === currency) {
          totalPrice = ticketPrice + hotelPrice;
          displayCurrency = currency;
        } else {
          // If different currencies, show separately
          if (ticketPrice === 0) {
            totalPrice = hotelPrice;
            displayCurrency = currency;
          } else {
            totalCostEl.textContent = `${eventCurrency}${ticketPrice} + ${currency}${hotelPrice}`;
            return;
          }
        }
        
        if (ticketPrice === 0) {
          totalCostEl.textContent = `${displayCurrency}${totalPrice}`;
        } else {
          totalCostEl.textContent = `${displayCurrency}${totalPrice}`;
        }
      } else {
        totalCostEl.textContent = `${currency}${hotelPrice}`;
      }
    } else {
      hotelPriceEl.textContent = 'No pricing available';
      totalCostEl.textContent = '-';
    }
  }

  // Booking Storage Functions
  async function saveBookingToStorage(bookingResult, prebookData, holder, guests, eventDetails, additionalData = {}) {
    try {
      const bookingId = bookingResult.bookingId || bookingResult.id || 'GD' + Date.now().toString(36).toUpperCase();
      const { hotelData, hotelName, hotelPrice } = additionalData;
      
      // Calculate dates and nights
      const checkInDate = new Date(currentEventData?.date || new Date());
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 1); // Default 1 night stay
      
      const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
      
      const booking = {
        id: bookingId,
        bookingRef: bookingResult.bookingReference || bookingResult.confirmationNumber || bookingId,
        timestamp: new Date().toISOString(),
        status: 'confirmed',
        hotel: {
          id: hotelData?.id || prebookData.hotelId,
          name: hotelName || hotelData?.name || prebookData.hotelName || 'Unknown Hotel',
          image: hotelData?.images?.[0]?.url || hotelData?.image || './assets/icon128.png',
          address: hotelData?.address || prebookData.hotelAddress || 'Unknown Address',
          rating: hotelData?.rating || prebookData.rating || 'N/A',
          location: hotelData?.location || prebookData.location
        },
        room: {
          type: prebookData.roomName || hotelData?.roomType || 'Standard Room',
          rateName: prebookData.rateName || prebookData.boardName || 'Room Only',
          occupancy: prebookData.occupancy || guests?.length || 1
        },
        dates: {
          checkIn: checkInDate.toISOString().split('T')[0],
          checkOut: checkOutDate.toISOString().split('T')[0],
          nights: nights
        },
        pricing: {
          total: prebookData.totalPrice || hotelPrice?.total || 'N/A',
          currency: prebookData.currency || hotelPrice?.currency || 'USD',
          breakdown: {
            roomRate: prebookData.roomRate || hotelPrice?.roomRate,
            taxes: prebookData.taxesFees || hotelPrice?.taxes,
            fees: prebookData.facilityFee || hotelPrice?.fees
          }
        },
        holder: holder,
        guests: guests,
        event: {
          title: eventDetails?.title || 'Unknown Event',
          date: eventDetails?.date || 'Unknown Date',
          location: eventDetails?.location || 'Unknown Location',
          url: eventDetails?.url || window.location.href
        },
        prebookData: prebookData,
        hotelData: hotelData,
        apiResponse: bookingResult
      };

      // Get existing bookings
      const existingBookings = await getStoredBookings();
      existingBookings.push(booking);

      // Store in Chrome storage
      await chrome.storage.local.set({ 'gumdrop_bookings': existingBookings });
      
      console.log('Booking saved to storage:', booking);
      return booking;
    } catch (error) {
      console.error('Error saving booking:', error);
      throw error;
    }
  }

  async function getStoredBookings() {
    try {
      const result = await chrome.storage.local.get(['gumdrop_bookings']);
      return result.gumdrop_bookings || [];
    } catch (error) {
      console.error('Error retrieving bookings:', error);
      return [];
    }
  }

  async function getCurrentEventDetails() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      return {
        title: currentEventData?.title || 'Unknown Event',
        date: currentEventData?.date || 'Unknown Date', 
        location: currentEventData?.location || 'Unknown Location',
        url: currentTab?.url || window.location.href
      };
    } catch (error) {
      console.error('Error getting current event details:', error);
      return {
        title: 'Unknown Event',
        date: 'Unknown Date',
        location: 'Unknown Location',
        url: window.location.href
      };
    }
  }

  async function checkForExistingBooking() {
    try {
      const eventDetails = await getCurrentEventDetails();
      const bookings = await getStoredBookings();
      
      // Check if there's a booking for this event
      const existingBooking = bookings.find(booking => 
        booking.event.url === eventDetails.url || 
        (booking.event.title === eventDetails.title && booking.event.date === eventDetails.date)
      );
      
      return existingBooking;
    } catch (error) {
      console.error('Error checking for existing booking:', error);
      return null;
    }
  }

  function showBookingView(booking) {
    // Hide the main interface
    const loadingDiv = document.getElementById('loading');
    const noEventDiv = document.getElementById('no-event');
    const eventDetailsDiv = document.getElementById('event-details');
    const hotelResults = document.getElementById('hotel-results');
    
    [loadingDiv, noEventDiv, eventDetailsDiv, hotelResults].forEach(div => {
      if (div) div.classList.add('hidden');
    });
    
    // Create booking view container if it doesn't exist
    let bookingViewDiv = document.getElementById('booking-view');
    if (!bookingViewDiv) {
      bookingViewDiv = document.createElement('div');
      bookingViewDiv.id = 'booking-view';
      bookingViewDiv.className = 'p-4';
      document.body.appendChild(bookingViewDiv);
    }
    
    // Create booking view HTML
    bookingViewDiv.innerHTML = `
      <div class="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 mb-4">
        <div class="flex items-center space-x-3 mb-4">
          <div class="w-12 h-12 bg-gradient-to-br from-green-400 to-green-500 rounded-2xl flex items-center justify-center shadow-lg">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <div>
            <h2 class="text-xl font-bold text-green-800">Booking Confirmed!</h2>
            <p class="text-sm text-green-600">Your stay is all set</p>
          </div>
        </div>
        
        <div class="bg-white border border-green-200 rounded-xl p-4 mb-4">
          <div class="flex items-start space-x-4">
            <img src="${booking.hotel.image || './assets/icon128.png'}" alt="${booking.hotel.name}" class="w-16 h-16 rounded-lg object-cover">
            <div class="flex-1">
              <h3 class="font-bold text-lg text-slate-800">${booking.hotel.name}</h3>
              <p class="text-sm text-slate-600 mb-2">${booking.hotel.address}</p>
              <div class="flex items-center space-x-4 text-xs text-slate-500">
                <span>⭐ ${booking.hotel.rating}</span>
                <span>${booking.room.type}</span>
                <span>${booking.room.rateName}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="bg-white border border-green-200 rounded-xl p-4">
            <div class="text-xs text-green-600 font-medium mb-1">CHECK-IN</div>
            <div class="text-sm font-bold text-slate-800">${formatDate(booking.dates.checkIn)}</div>
          </div>
          <div class="bg-white border border-green-200 rounded-xl p-4">
            <div class="text-xs text-green-600 font-medium mb-1">CHECK-OUT</div>
            <div class="text-sm font-bold text-slate-800">${formatDate(booking.dates.checkOut)}</div>
          </div>
        </div>
        
        <div class="bg-white border border-green-200 rounded-xl p-4 mb-4">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-medium text-slate-700">Booking Reference</span>
            <span class="text-sm font-bold text-green-700">${booking.bookingRef}</span>
          </div>
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-medium text-slate-700">Total Cost</span>
            <span class="text-lg font-bold text-green-700">${booking.pricing.currency} ${booking.prebookData.price}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-slate-700">Nights</span>
            <span class="text-sm font-bold text-slate-700">${booking.dates.nights}</span>
          </div>
        </div>
        
        <div class="bg-white border border-green-200 rounded-xl p-4 mb-4">
          <h4 class="font-bold text-slate-800 mb-2">Event Details</h4>
          <p class="text-sm text-slate-700 font-medium">${booking.event.title}</p>
          <p class="text-xs text-slate-500">${booking.event.date}</p>
          <p class="text-xs text-slate-500">${booking.event.location}</p>
        </div>
        
        <div class="flex space-x-3">
          <button id="view-all-bookings" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors duration-200">
            All Bookings
          </button>
          <button id="cancel-booking-btn" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-xl transition-colors duration-200">
            Cancel Booking
          </button>
        </div>
      </div>
    `;
    
    bookingViewDiv.classList.remove('hidden');
    
    // Add event listeners
    document.getElementById('view-all-bookings')?.addEventListener('click', () => {
      openAllBookingsPage();
    });
    
    document.getElementById('cancel-booking-btn')?.addEventListener('click', () => {
      cancelBooking(booking);
    });
  }

  async function cancelBooking(booking) {
    if (confirm(`Are you sure you want to cancel your booking at ${booking.hotel.name}? This action cannot be undone.`)) {
      try {
        // Remove from storage
        const bookings = await getStoredBookings();
        const updatedBookings = bookings.filter(b => b.id !== booking.id);
        await chrome.storage.local.set({ 'gumdrop_bookings': updatedBookings });
        
        showNotification('Booking cancelled successfully', 'success');
        
        // Hide booking view and show normal interface
        document.getElementById('booking-view')?.classList.add('hidden');
        await loadEventData(); // Reload the normal interface
        
      } catch (error) {
        console.error('Error cancelling booking:', error);
        showNotification('Failed to cancel booking', 'error');
      }
    }
  }

  function openAllBookingsPage() {
    chrome.tabs.create({ 
      url: chrome.runtime.getURL('all-bookings.html')
    });
  }

  // Handle Generate Stay Plan button
  generateBtn.addEventListener('click', async function() {
    if (generateBtn.disabled || !currentEventData || !currentEventData.location) {
      alert('No event location found. Please make sure you\'re on an Eventbrite event page.');
      return;
    }
    
    // Show loading state
    generateBtn.innerHTML = '<svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Finding Hotels...';
    generateBtn.disabled = true;
    
    try {
      console.log('Finding hotels for location:', currentEventData.location);
      
      let hotelData;
      
      // Try localhost API first
      try {
        console.log('Calling localhost API for hotels...');
        console.log(currentEventData);
        console.log(currentEventData.address);
        
        // Step 1: Get list of hotels
        const apiResponse = await fetch('http://localhost:3000/api/hotels', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            location: currentEventData.location,
            address: currentEventData.address,
            radius: currentRadius
          })
        });
        
        if (!apiResponse.ok) {
          throw new Error(`API responded with status: ${apiResponse.status}`);
        }
        
        hotelData = await apiResponse.json();
        console.log('Successfully loaded hotels from API:', hotelData.data?.length || 0, 'hotels found');
        
        // Step 2: Get pricing details for all hotels
        if (hotelData.data?.length > 0 && currentEventData.date) {
          try {
            const hotelIds = hotelData.data.map(hotel => hotel.id);
            console.log('Getting pricing for hotel IDs:', hotelIds);
            
            const detailsResponse = await fetch('http://localhost:3000/api/hotels_details', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                hotelIds: hotelIds,
                eventDate: currentEventData.date
              })
            });
            
            if (detailsResponse.ok) {
              const pricingData = await detailsResponse.json();
              console.log('Got pricing data:', pricingData);
              
              // Only keep hotels that have pricing data
              const hotelsWithPricing = [];
              
              if (pricingData.data) {
                pricingData.data.forEach(hotelPricing => {
                  const hotel = hotelData.data.find(h => h.id === hotelPricing.hotelId);
                  if (hotel && hotelPricing.roomTypes?.length > 0) {
                    // Get the best (cheapest) rate
                    const bestRoom = hotelPricing.roomTypes.reduce((best, room) => 
                      !best || room.offerRetailRate.amount < best.offerRetailRate.amount ? room : best
                    );
                    
                    hotel.pricing = {
                      amount: bestRoom.offerRetailRate.amount,
                      currency: bestRoom.offerRetailRate.currency,
                      roomName: bestRoom.rates[0]?.name || 'Standard Room',
                      boardName: bestRoom.rates[0]?.boardName || '',
                      offerId: bestRoom.offerId,
                      rateId: bestRoom.rates[0]?.rateId,
                      checkin: pricingData.checkin,
                      checkout: pricingData.checkout
                    };
                    
                    hotelsWithPricing.push(hotel);
                  }
                });
              }
              
              // Replace hotelData with only hotels that have pricing
              hotelData.data = hotelsWithPricing;
              console.log('Hotels with pricing data:', hotelsWithPricing.length);
              
            } else {
              console.log('Failed to get pricing data');
              hotelData.data = []; // No hotels to show if pricing fails
            }
          } catch (pricingError) {
            console.log('Error getting pricing data:', pricingError.message);
            hotelData.data = []; // No hotels to show if pricing fails
          }
        }
        
        // Update status indicator
        updateApiStatus('connected');
        
      } catch (apiError) {
        console.error('API call failed:', apiError.message);
        
        // Update status indicator
        updateApiStatus('offline');
        
        // Use fallback demo data when API fails
        console.log('Using demo hotel data as fallback');
        hotelData = {
          data: [
            {
              id: 'demo-1',
              name: 'The Grand London Hotel',
              address: '123 Piccadilly Circus',
              city: 'London',
              rating: 4.5,
              thumbnail: '',
              main_photo: '',
              pricing: {
                amount: 245,
                currency: 'GBP',
                roomName: 'Superior King Room',
                boardName: 'Breakfast Included',
                offerId: 'demo-offer-1',
                rateId: 'demo-rate-1'
              }
            },
            {
              id: 'demo-2',
              name: 'Budget Stay Central',
              address: '456 Kings Cross Road',
              city: 'London',
              rating: 4.1,
              thumbnail: '',
              main_photo: '',
              pricing: {
                amount: 89,
                currency: 'GBP',
                roomName: 'Standard Double Room',
                boardName: 'Room Only',
                offerId: 'demo-offer-2',
                rateId: 'demo-rate-2'
              }
            },
            {
              id: 'demo-3',
              name: 'Luxury Palace Hotel',
              address: '789 Park Lane',
              city: 'London',
              rating: 4.8,
              thumbnail: '',
              main_photo: '',
              pricing: {
                amount: 450,
                currency: 'GBP',
                roomName: 'Executive Suite',
                boardName: 'Full Board',
                offerId: 'demo-offer-3',
                rateId: 'demo-rate-3'
              }
            },
            {
              id: 'demo-4',
              name: 'Modern Business Hotel',
              address: '321 Canary Wharf',
              city: 'London',
              rating: 4.3,
              thumbnail: '',
              main_photo: '',
              pricing: {
                amount: 180,
                currency: 'GBP',
                roomName: 'Business King Room',
                boardName: 'Continental Breakfast',
                offerId: 'demo-offer-4',
                rateId: 'demo-rate-4'
              }
            },
            {
              id: 'demo-5',
              name: 'Boutique Charm Hotel',
              address: '654 Covent Garden',
              city: 'London',
              rating: 4.6,
              thumbnail: '',
              main_photo: '',
              pricing: {
                amount: 320,
                currency: 'GBP',
                roomName: 'Deluxe Garden View',
                boardName: 'Breakfast & Dinner',
                offerId: 'demo-offer-5',
                rateId: 'demo-rate-5'
              }
            }
          ]
        };
      }
      
      // Display results
      displayHotelResults(hotelData);
      
    } catch (error) {
      console.error('Error calling hotels API:', error);
      
      // Show error in results section
      resultsSection.classList.remove('hidden');
      resultsSection.innerHTML = `
        <div class="mt-4 pt-3 border-t border-gray-200">
          <p class="text-xs text-red-500 mb-2 font-medium flex items-center">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Error fetching hotels
          </p>
          <div class="bg-red-50 rounded-lg p-3 text-sm border border-red-200">
            <p class="text-red-700 font-medium">Failed to connect to hotel service. Make sure the backend server is running on localhost:3000</p>
            <p class="text-red-600 text-xs mt-1">Error: ${error.message}</p>
          </div>
        </div>
      `;
    } finally {
      generateBtn.innerHTML = '<svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9"/></svg>Find & Book Hotels';
      generateBtn.disabled = false;
    }
  });

  let currentHotelIndex = 0;
  let hotelCards = [];
  
  function displayHotelResults(hotelData) {
    // Show the hotels section
    hotelsSection.classList.remove('hidden');
    
    // Handle Nuitee API response format
    const hotels = hotelData.data || [];
    hotelCards = hotels; // Store for navigation
    
    // Show booking dates if we have pricing data
    if (hotels.length > 0 && hotels[0].pricing) {
      const bookingDates = document.getElementById('booking-dates');
      const stayDates = document.getElementById('stay-dates');
      if (bookingDates && stayDates) {
        const checkin = formatDate(hotels[0].pricing.checkin);
        const checkout = formatDate(hotels[0].pricing.checkout);
        stayDates.textContent = `${checkin} → ${checkout}`;
        bookingDates.classList.remove('hidden');
      }
    }
    
    if (hotels.length > 0) {
      // Update total hotels count
      const totalCountElement = document.getElementById('total-hotels-count');
      if (totalCountElement) {
        totalCountElement.textContent = hotels.length;
      }

      // Update cost estimate with cheapest hotel price
      updateCostEstimateWithHotels(hotels);

      // Get AI recommendations for top hotels
      getAIHotelRecommendations(hotels.slice(0, Math.min(10, hotels.length))); // Use top 10 for AI analysis
      
      // Prepare detailed view
      prepareDetailedView(hotels);

      // Setup view all hotels button
      setupViewAllHotelsButton();
    } else {
      document.getElementById('quick-results').innerHTML = `
        <div class="bg-white rounded-2xl p-6 text-center border border-slate-200/50">
          <div class="w-12 h-12 mx-auto mb-3 bg-slate-100 rounded-2xl flex items-center justify-center">
            <svg class="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
          </div>
          <p class="text-lg font-bold text-slate-900 mb-2">No hotels found</p>
          <p class="text-sm text-slate-600">Try searching in a different area</p>
        </div>
      `;
    }
  }

  // Get AI recommendations for hotels
  async function getAIHotelRecommendations(hotels) {
    try {
      // Show loading state
      displayQuickResultsLoading();
      
      const eventDetails = await getCurrentEventDetails();
      
      const response = await fetch('http://localhost:3000/api/ai/hotels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hotels: hotels,
          eventDetails: eventDetails
        })
      });
      
      if (!response.ok) {
        throw new Error('AI recommendation failed');
      }
      
      const aiResult = await response.json();
      
      if (aiResult.success && aiResult.recommendations) {
        displayAIRecommendedHotels(hotels, aiResult.recommendations);
      } else {
        // Fallback to regular display
        displayQuickResults(hotels.slice(0, 3));
      }
      
    } catch (error) {
      console.error('Error getting AI recommendations:', error);
      
      // Create fallback recommendations based on price analysis
      console.log('Using fallback AI categorization based on pricing');
      
      const sortedByPrice = [...hotels].sort((a, b) => {
        const priceA = a.pricing?.amount || 999;
        const priceB = b.pricing?.amount || 999;
        return priceA - priceB;
      });
      
      const fallbackRecommendations = {
        budget: {
          hotel: sortedByPrice[0],
          reason: "Most affordable option with great value for money"
        },
        luxury: {
          hotel: sortedByPrice[sortedByPrice.length - 1],
          reason: "Premium accommodation with top-tier amenities"
        },
        overall: {
          hotel: sortedByPrice[Math.floor(sortedByPrice.length / 2)] || sortedByPrice[0],
          reason: "Perfect balance of comfort, location, and price"
        }
      };
      
      displayAIRecommendedHotels(hotels, fallbackRecommendations);
    }
  }

  // Show loading state for quick results
  function displayQuickResultsLoading() {
    const quickResults = document.getElementById('quick-results');
    quickResults.innerHTML = `
      <div class="bg-white rounded-2xl p-6 text-center border border-slate-200/50">
        <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-slate-600 font-medium">AI is analyzing hotels for you...</p>
        <p class="text-xs text-slate-500 mt-1">Finding the best budget, luxury, and overall options</p>
      </div>
    `;
  }

  // Display AI-recommended hotels with categories
  function displayAIRecommendedHotels(hotels, recommendations) {
    const quickResults = document.getElementById('quick-results');
    quickResults.innerHTML = '';
    
    const categories = [
      {
        key: 'bestBudget',
        title: 'Best Budget',
        icon: '💰',
        color: 'from-green-500 to-emerald-600',
        bgColor: 'from-green-50 to-emerald-50',
        borderColor: 'border-green-200'
      },
      {
        key: 'mostLuxurious', 
        title: 'Most Luxurious',
        icon: '✨',
        color: 'from-purple-500 to-violet-600',
        bgColor: 'from-purple-50 to-violet-50',
        borderColor: 'border-purple-200'
      },
      {
        key: 'bestOverall',
        title: 'Best Overall',
        icon: '⭐',
        color: 'from-blue-500 to-indigo-600', 
        bgColor: 'from-blue-50 to-indigo-50',
        borderColor: 'border-blue-200'
      }
    ];

    categories.forEach(category => {
      const recommendation = recommendations[category.key];
      if (recommendation && hotels[recommendation.index]) {
        const hotel = hotels[recommendation.index];
        const quickCard = createAIRecommendedHotelCard(hotel, category, recommendation.reason);
        quickResults.appendChild(quickCard);
      }
    });

    // Setup event listeners for all booking buttons
    setupAllBookingButtons();
  }

  // Create AI recommended hotel card with category styling
  function createAIRecommendedHotelCard(hotel, category, reason) {
    const name = hotel.name || 'Unknown Hotel';
    const address = hotel.address || '';
    const rating = hotel.rating && hotel.rating > 0 ? hotel.rating : (4.2 + Math.random() * 0.6).toFixed(1);
    
    let price, roomInfo = '';
    if (hotel.pricing) {
      const symbol = hotel.pricing.currency === 'GBP' ? '£' : '$';
      price = `${symbol}${hotel.pricing.amount}`;
      if (hotel.pricing.boardName) {
        roomInfo = hotel.pricing.boardName;
      }
    } else {
      price = '$' + (Math.floor(Math.random() * 200) + 80);
    }
    
    const photo = hotel.thumbnail || hotel.main_photo || '';
    const distance = hotel.distance ? `${hotel.distance.toFixed(1)}km` : `${(Math.random() * 5 + 0.5).toFixed(1)}km`;
    
    const quickCard = document.createElement('div');
    quickCard.className = `bg-gradient-to-br ${category.bgColor} rounded-2xl border ${category.borderColor} shadow-sm overflow-hidden hover:shadow-lg transition-all duration-200`;
    
    quickCard.innerHTML = `
      <div class="p-4">
        <div class="flex space-x-3">
          <!-- Hotel Image -->
          <div class="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex-shrink-0 overflow-hidden relative">
            ${photo ? `<img src="${photo}" alt="${name}" class="w-full h-full object-cover">` : `
              <div class="flex items-center justify-center h-full">
                <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
              </div>
            `}
            <div class="absolute -top-1 -right-1 bg-gradient-to-r ${category.color} text-white text-xs font-black px-2 py-1 rounded-lg shadow-sm flex items-center">
              <span class="mr-1">${category.icon}</span>
              ${category.title.toUpperCase()}
            </div>
          </div>
          
          <!-- Hotel Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between mb-2">
              <h3 class="font-bold text-sm text-slate-800 leading-tight truncate">${name}</h3>
              <div class="text-right ml-2">
                <div class="font-bold text-lg text-slate-800">${price}</div>
                <div class="text-xs text-slate-500">per night</div>
              </div>
            </div>
            
            <div class="space-y-1 mb-3">
              <div class="flex items-center text-xs text-slate-600">
                <svg class="w-3 h-3 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <span class="truncate">${distance} away</span>
              </div>
              <div class="flex items-center justify-between">
                <div class="flex items-center text-xs text-amber-600">
                  <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                  <span>${rating}</span>
                </div>
                ${roomInfo ? `<span class="text-xs text-slate-500 truncate">${roomInfo}</span>` : ''}
              </div>
            </div>
            
            <!-- AI Reason -->
            <div class="bg-white/60 rounded-lg p-2 mb-3">
              <p class="text-xs text-slate-700 italic">"${reason}"</p>
            </div>
            
            <button class="book-now-btn w-full bg-gradient-to-r ${category.color} text-white font-medium py-2 px-3 rounded-lg text-sm hover:shadow-md transition-all duration-200 transform hover:scale-105"
                    data-hotel-name="${name}" 
                    data-hotel-price="${price}">
              Book Now
            </button>
          </div>
        </div>
      </div>
    `;
    
    return quickCard;
  }

  // Setup the "View All Hotels" button functionality
  function setupViewAllHotelsButton() {
    const viewAllBtn = document.getElementById('view-all-hotels-btn');
    const detailedView = document.getElementById('detailed-view');
    
    if (viewAllBtn && detailedView) {
      // Remove any existing listeners
      const newBtn = viewAllBtn.cloneNode(true);
      viewAllBtn.parentNode.replaceChild(newBtn, viewAllBtn);
      
      // Add click handler
      newBtn.addEventListener('click', () => {
        // Toggle detailed view
        if (detailedView.classList.contains('hidden')) {
          detailedView.classList.remove('hidden');
          newBtn.innerHTML = `
            <div class="flex items-center justify-center space-x-3">
              <svg class="w-5 h-5 text-slate-600 group-hover:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
              </svg>
              <span>Hide All Hotels</span>
              <div class="bg-slate-300 text-slate-600 text-xs px-2 py-1 rounded-lg font-bold">
                <span id="total-hotels-count">${document.getElementById('total-hotels-count')?.textContent || '0'}</span> available
              </div>
            </div>
            <p class="text-xs text-slate-500 mt-1">Back to AI recommendations only</p>
          `;
          
          // Scroll to detailed view
          detailedView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          detailedView.classList.add('hidden');
          newBtn.innerHTML = `
            <div class="flex items-center justify-center space-x-3">
              <svg class="w-5 h-5 text-slate-600 group-hover:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
              <span>View All Hotels</span>
              <div class="bg-slate-300 text-slate-600 text-xs px-2 py-1 rounded-lg font-bold">
                <span id="total-hotels-count">${document.getElementById('total-hotels-count')?.textContent || '0'}</span> available
              </div>
            </div>
            <p class="text-xs text-slate-500 mt-1">Browse complete list with filters and detailed comparison</p>
          `;
        }
        
        // Re-setup the button (since we changed the innerHTML)
        setupViewAllHotelsButton();
      });
    }
  }

  function displayQuickResults(topHotels) {
    const quickResults = document.getElementById('quick-results');
    quickResults.innerHTML = '';

    topHotels.forEach((hotel, index) => {
      const name = hotel.name || 'Unknown Hotel';
      const address = hotel.address || '';
      const city = hotel.city || '';
      const rating = hotel.rating && hotel.rating > 0 ? hotel.rating : (4.2 + Math.random() * 0.6).toFixed(1);
      
      // Use real pricing data if available
      let price, roomInfo = '';
      if (hotel.pricing) {
        const symbol = hotel.pricing.currency === 'GBP' ? '£' : '$';
        price = `${symbol}${hotel.pricing.amount}`;
        if (hotel.pricing.boardName) {
          roomInfo = hotel.pricing.boardName;
        }
      } else {
        price = '$' + (Math.floor(Math.random() * 200) + 80);
      }
      
      const photo = hotel.thumbnail || hotel.main_photo || '';
      const distance = hotel.distance ? `${hotel.distance.toFixed(1)}km` : `${(Math.random() * 5 + 0.5).toFixed(1)}km`;
      
      // Best deal badge for top hotel
      const isBestDeal = index === 0;
      
      const quickCard = document.createElement('div');
      quickCard.className = 'bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden hover:shadow-lg transition-all duration-200';
      
      quickCard.innerHTML = `
        <div class="p-4">
          <div class="flex space-x-3">
            <!-- Hotel Image -->
            <div class="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex-shrink-0 overflow-hidden relative">
              ${photo ? `<img src="${photo}" alt="${name}" class="w-full h-full object-cover">` : `
                <div class="flex items-center justify-center h-full">
                  <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                  </svg>
                </div>
              `}
              ${isBestDeal ? `
                <div class="absolute -top-1 -right-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-black px-1.5 py-0.5 rounded-lg shadow-sm">
                  BEST
                </div>
              ` : ''}
            </div>
            
            <!-- Hotel Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between mb-1">
                <h3 class="font-bold text-slate-900 text-sm leading-tight line-clamp-1">${name}</h3>
                <div class="flex items-center space-x-1 text-xs text-yellow-600 font-bold ml-2">
                  <span>${rating}</span>
                  <svg class="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                </div>
              </div>
              
              <div class="flex items-center space-x-3 text-xs text-slate-600 mb-2">
                <span class="flex items-center">
                  <svg class="w-3 h-3 mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  ${distance}
                </span>
                ${roomInfo ? `
                  <span class="flex items-center">
                    <svg class="w-3 h-3 mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>
                    </svg>
                    ${roomInfo}
                  </span>
                ` : `
                  <span class="flex items-center">
                    <svg class="w-3 h-3 mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8h4m-4 4h4"/>
                    </svg>
                    Free parking
                  </span>
                `}
              </div>
              
              <div class="flex items-end justify-between">
                <div>
                  <p class="text-xs text-slate-500">${hotel.pricing ? 'Per night from' : 'Est. per night'}</p>
                  <p class="font-black text-slate-900 text-lg">${price}</p>
                </div>
                
                <!-- One-Click Book Button -->
                <button class="book-now-btn bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-bold px-4 py-2 rounded-xl text-sm shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center space-x-1"
                        data-hotel-name="${name}" data-hotel-price="${price}">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <span>Book Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      quickResults.appendChild(quickCard);
    });

    // Add "See All Hotels" button
    const seeAllButton = document.createElement('div');
    seeAllButton.innerHTML = `
      <button id="show-detailed" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-2xl border-2 border-dashed border-slate-300 hover:border-slate-400 transition-all duration-200">
        <div class="flex items-center justify-center space-x-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <span>See All ${hotelCards.length} Hotels</span>
        </div>
      </button>
    `;
    quickResults.appendChild(seeAllButton);

    // Add event listeners
    setupQuickBooking();
    
    // Add detailed booking listeners
    document.querySelectorAll('.book-detailed-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const hotelName = this.dataset.hotelName;
        const hotelPrice = this.dataset.hotelPrice;
        handleQuickBooking(hotelName, hotelPrice, this);
      });
    });
  }

  function prepareDetailedView(hotels) {
    const hotelsStack = document.getElementById('hotels-stack');
    const hotelsCounter = document.getElementById('hotel-counter');
    
    currentHotelIndex = 0;
    hotelsCounter.textContent = `Viewing 1 of ${hotels.length} hotels`;
    
    // Clear and populate detailed hotel stack
    hotelsStack.innerHTML = '';
    
    hotels.forEach((hotel, index) => {
      const hotelCard = document.createElement('div');
      hotelCard.className = 'hotel-card absolute top-0 left-0 w-full h-full bg-white rounded-2xl shadow-lg border border-slate-200/50 overflow-hidden';
      hotelCard.style.zIndex = hotels.length - index;
      hotelCard.style.transform = `translateX(${index * 3}px) translateY(${index * 2}px) scale(${1 - index * 0.015})`;
      hotelCard.setAttribute('data-index', index);
      
      const name = hotel.name || 'Unknown Hotel';
      const address = hotel.address || '';
      const city = hotel.city || '';
      const rating = hotel.rating && hotel.rating > 0 ? hotel.rating : (4.2 + Math.random() * 0.6).toFixed(1);
      
      // Use real pricing data if available
      let price, roomDetails = '';
      if (hotel.pricing) {
        const symbol = hotel.pricing.currency === 'GBP' ? '£' : '$';
        price = `${symbol}${hotel.pricing.amount}`;
        roomDetails = hotel.pricing.roomName || 'Standard Room';
      } else {
        price = '$' + (Math.floor(Math.random() * 200) + 100);
        roomDetails = 'Standard Room';
      }
      
      const photo = hotel.thumbnail || hotel.main_photo || '';
      
      hotelCard.innerHTML = `
        <div class="relative h-full">
          <!-- Hotel Image -->
          <div class="h-20 bg-gradient-to-br from-slate-100 via-slate-50 to-yellow-50 relative overflow-hidden">
            ${photo ? `<img src="${photo}" alt="${name}" class="w-full h-full object-cover">` : `
              <div class="flex items-center justify-center h-full">
                <div class="w-10 h-10 bg-gradient-to-br from-slate-300 to-slate-400 rounded-xl flex items-center justify-center">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                  </svg>
                </div>
              </div>
            `}
            
            <div class="absolute top-2 right-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-2 py-1 rounded-xl text-xs font-black shadow-sm flex items-center space-x-1">
              <span>${rating}</span>
              <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
            </div>
          </div>
          
          <!-- Hotel Details -->
          <div class="p-3 h-44 flex flex-col">
            <div class="flex-1">
              <h3 class="font-black text-slate-900 text-sm mb-1 leading-tight line-clamp-2">${name}</h3>
              <p class="text-slate-600 text-xs mb-1 font-medium line-clamp-1">${address}${city ? `, ${city}` : ''}</p>
              <p class="text-slate-500 text-xs mb-2 line-clamp-1">${roomDetails}</p>
              
              <!-- Amenities -->
              <div class="flex items-center space-x-2 mb-3">
                <div class="w-5 h-5 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg class="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div class="w-5 h-5 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg class="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8h4m-4 4h4"/>
                  </svg>
                </div>
                <div class="w-5 h-5 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg class="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/>
                  </svg>
                </div>
                <div class="w-5 h-5 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg class="w-3 h-3 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0A1.5 1.5 0 013 15.546V6.454a1.5 1.5 0 011.5-.454c.523 0 1.046.151 1.5.454a2.704 2.704 0 003 0 2.704 2.704 0 013 0 2.704 2.704 0 003 0 2.704 2.704 0 013 0c.454-.303.977-.454 1.5-.454A1.5 1.5 0 0121 6.454v9.092z"/>
                  </svg>
                </div>
              </div>
              
              <div class="flex items-center justify-between mb-3">
                <div class="flex-1">
                  <p class="text-xs text-slate-500 font-medium">${hotel.pricing ? 'Per night' : 'Est. per night'}</p>
                  <p class="font-black text-slate-900 text-lg">${price}</p>
                  ${hotel.pricing && hotel.pricing.boardName ? `
                    <p class="text-xs text-green-600 font-medium">${hotel.pricing.boardName}</p>
                  ` : ''}
                </div>
                
                <!-- Booking Button on the Right -->
                <div class="flex flex-col gap-1">
                  <button class="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 hover:scale-105 shadow-lg book-detailed-btn"
                          data-hotel-name="${name}" data-hotel-price="${price}">
                    Book Now
                  </button>
                  <button class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 hover:scale-105">
                    More Info
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      hotelsStack.appendChild(hotelCard);
    });

    // Setup all booking buttons after cards are created
    setupAllBookingButtons();
  }

  // Consolidated function to setup all booking buttons
  function setupAllBookingButtons() {
    // Remove existing listeners first
    document.querySelectorAll('.book-now-btn, .book-detailed-btn').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
    });

    // AI recommendation buttons  
    document.querySelectorAll('.book-now-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const hotelName = this.dataset.hotelName;
        const hotelPrice = this.dataset.hotelPrice;
        console.log('AI Book Now clicked:', hotelName, hotelPrice);
        handleQuickBooking(hotelName, hotelPrice, this);
      });
    });

    // Detailed view buttons
    document.querySelectorAll('.book-detailed-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const hotelName = this.dataset.hotelName;
        const hotelPrice = this.dataset.hotelPrice;
        console.log('Detailed Book Now clicked:', hotelName, hotelPrice);
        handleQuickBooking(hotelName, hotelPrice, this);
      });
    });

    // Show detailed view button
    document.getElementById('show-detailed')?.addEventListener('click', function() {
      document.getElementById('detailed-view').classList.remove('hidden');
      document.getElementById('search-filters').classList.remove('hidden');
      setupHotelNavigation();
    });

    // Close detailed view button
    document.getElementById('close-detailed')?.addEventListener('click', function() {
      document.getElementById('detailed-view').classList.add('hidden');
      document.getElementById('search-filters').classList.add('hidden');
    });
  }

  async function handleQuickBooking(hotelName, hotelPrice, button) {
    console.log('handleQuickBooking called with:', { hotelName, hotelPrice });
    
    // Show loading state
    const originalText = button.innerHTML;
    button.innerHTML = '<svg class="w-3 h-3 inline mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Loading...';
    button.disabled = true;
    
    try {
      // Get the hotel data to find the rate ID
      const hotelData = findHotelByName(hotelName);
      console.log('Hotel data found:', hotelData);
      
      if (!hotelData) {
        throw new Error('Hotel information not found. Please try refreshing the page.');
      }
      
      if (!hotelData.rateId) {
        console.warn('No rate ID found, using demo booking');
      }
      
      // Call prebook API
      console.log('Calling prebook API for rate:', hotelData.rateId);
      console.log(hotelData.pricing.offerId);
      const prebookResponse = await fetch('http://localhost:3000/api/prebook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // rateId: hotelData.rateId,
          offerId: hotelData.pricing.offerId
        })
      });
      
      if (!prebookResponse.ok) {
        throw new Error(`Prebook failed: ${prebookResponse.status}`);
      }
      
      const prebookData = await prebookResponse.json();
      console.log('Prebook response:', prebookData);
      
      // Reset button
      button.innerHTML = originalText;
      button.disabled = false;
      
      // Show prebooking modal with real API data
      showPrebookingModal({
        hotelName: hotelName,
        hotelPrice: hotelPrice,
        prebookingData: prebookData.data,
        hotelData: hotelData, // Include full hotel data
        rateId: hotelData.rateId
      });
      
    } catch (error) {
      console.error('Prebook error:', error);
      
      // Reset button
      button.innerHTML = originalText;
      button.disabled = false;
      
      // Show error or fallback to sample data
      showPrebookingModal({
        hotelName: hotelName,
        hotelPrice: hotelPrice,
        hotelData: hotelData, // Include full hotel data even for demo
        prebookingData: {
          prebookId: "demo_" + Math.random().toString(36).substr(2, 9),
          roomName: "Standard King Room - Room only",
          boardName: "Room Only",
          roomRate: 163.66,
          taxesFees: 23.53,
          facilityFee: 43.61,
          totalPrice: 230.80,
          currency: "USD",
          guestCount: "2 Adults",
          paymentType: "Nuitee Pay",
          cancellationInfo: "Free cancellation until 2:00 AM on Mar 30, 2025",
          refundable: true,
          isDemo: true
        }
      });
    }
  }

  // Helper function to find hotel data by name
  function findHotelByName(hotelName) {
    console.log('Looking for hotel:', hotelName);
    console.log('Available hotels:', hotelCards);
    
    if (!hotelCards || hotelCards.length === 0) {
      console.log('No hotel cards available');
      return null;
    }
    
    const hotel = hotelCards.find(h => h.name === hotelName);
    console.log('Found hotel:', hotel);
    
    if (hotel) {
      // Try to find rate ID from different possible locations
      let rateId = null;
      if (hotel.pricing && hotel.pricing.rateId) {
        rateId = hotel.pricing.rateId;
      } else if (hotel.rateId) {
        rateId = hotel.rateId;
      } else if (hotel.pricing && hotel.pricing.offerId) {
        rateId = hotel.pricing.offerId;
      }
      
      console.log('Rate ID found:', rateId);
      
      return {
        ...hotel,
        rateId: rateId || `rate_${hotel.id || Math.random().toString(36).substr(2, 9)}`
      };
    }
    
    console.log('Hotel not found in cards array');
    return null;
  }

  async function showPrebookingModal(bookingDetails) {
    const modal = document.getElementById('prebooking-modal');
    const { hotelName, prebookingData, hotelPrice, hotelData } = bookingDetails;
    
    // Store complete booking data for later confirmation
    window.currentPrebookData = prebookingData;
    window.currentHotelData = hotelData; // Store full hotel data
    window.currentHotelName = hotelName;
    window.currentHotelPrice = hotelPrice;
    
    // Handle real API data vs demo data
    let roomName, boardName, totalPrice, currency, prebookId;
    
    if (prebookingData.isDemo) {
      roomName = prebookingData.roomName;
      boardName = prebookingData.boardName;
      totalPrice = prebookingData.totalPrice;
      currency = prebookingData.currency;
      prebookId = prebookingData.prebookId;
    } else {
      // Parse real API data
      const roomType = prebookingData.roomTypes?.[0];
      const rate = roomType?.rates?.[0];
      
      roomName = rate?.name || "Standard Room";
      boardName = rate?.boardName || "Room Only";
      currency = rate?.retailRate?.total?.[0]?.currency || prebookingData.currency || "USD";
      totalPrice = prebookingData.price || hotelPrice || 0;
      prebookId = prebookingData.prebookId;
    }
    
    // Populate hotel details
    document.getElementById('booking-hotel-name').textContent = hotelName;
    document.getElementById('hotel-name-display').textContent = hotelName;
    document.getElementById('hotel-address').textContent = "Event Location Area"; // Could be enhanced with real address
    document.getElementById('room-name').textContent = roomName;
    document.getElementById('room-board').textContent = boardName;
    document.getElementById('total-price-display').textContent = `${currency === 'USD' ? '$' : '£'}${totalPrice.toFixed(2)}`;
    document.getElementById('price-breakdown').textContent = "Includes all taxes and fees";
    
    // Load and populate holder information from user profile
    try {
      const userProfile = await getUserProfile();
      document.getElementById('holder-firstname').value = userProfile.firstName || '';
      document.getElementById('holder-lastname').value = userProfile.lastName || '';
      document.getElementById('holder-email').value = userProfile.email || '';
      document.getElementById('holder-phone').value = userProfile.phone || '';
      
      // Also populate the first guest with holder info by default
      const firstGuestForm = document.querySelector('.guest-form[data-guest-number="1"]');
      if (firstGuestForm) {
        firstGuestForm.querySelector('.guest-firstname').value = userProfile.firstName || '';
        firstGuestForm.querySelector('.guest-lastname').value = userProfile.lastName || '';
        firstGuestForm.querySelector('.guest-email').value = userProfile.email || '';
        firstGuestForm.querySelector('.guest-phone').value = userProfile.phone || '';
      }
    } catch (error) {
      console.error('Error loading user profile for booking form:', error);
    }
    
    // Reset guests container to show only mandatory first guest
    resetGuestsContainer();
    
    // Show modal
    modal.classList.remove('hidden');
  }
  
  // Reset guests container to default state
  function resetGuestsContainer() {
    const guestsContainer = document.getElementById('guests-container');
    const addGuestBtn = document.getElementById('add-guest-btn');
    
    // Remove all guest forms except the first one
    const allGuestForms = guestsContainer.querySelectorAll('.guest-form');
    allGuestForms.forEach((form, index) => {
      if (index > 0) {
        form.remove();
      }
    });
    
    // Reset add button state
    addGuestBtn.disabled = false;
    addGuestBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  }
  
  // Add new guest form
  function addGuestForm() {
    const guestsContainer = document.getElementById('guests-container');
    const addGuestBtn = document.getElementById('add-guest-btn');
    const currentGuestCount = guestsContainer.querySelectorAll('.guest-form').length;
    
    // Limit to 2 guests maximum
    if (currentGuestCount >= 2) {
      return;
    }
    
    const newGuestNumber = currentGuestCount + 1;
    const guestFormHTML = `
      <div class="guest-form bg-white border border-green-300 rounded-lg p-3" data-guest-number="${newGuestNumber}">
        <div class="flex items-center justify-between mb-3">
          <h5 class="font-semibold text-green-800 text-sm">Guest ${newGuestNumber}</h5>
          <button class="remove-guest-btn text-red-500 hover:text-red-700 text-xs font-medium flex items-center">
            <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Remove
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs font-medium text-green-700 mb-1">First Name</label>
            <input type="text" class="guest-firstname w-full px-2 py-1.5 text-xs border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="First name">
          </div>
          <div>
            <label class="block text-xs font-medium text-green-700 mb-1">Last Name</label>
            <input type="text" class="guest-lastname w-full px-2 py-1.5 text-xs border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Last name">
          </div>
          <div>
            <label class="block text-xs font-medium text-green-700 mb-1">Email</label>
            <input type="email" class="guest-email w-full px-2 py-1.5 text-xs border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="email@example.com">
          </div>
          <div>
            <label class="block text-xs font-medium text-green-700 mb-1">Phone</label>
            <input type="tel" class="guest-phone w-full px-2 py-1.5 text-xs border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Phone number">
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-green-700 mb-1">Special Requests</label>
          <textarea class="guest-remarks w-full px-2 py-1.5 text-xs border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500" rows="2" placeholder="Any special requests or remarks..."></textarea>
        </div>
      </div>
    `;
    
    guestsContainer.insertAdjacentHTML('beforeend', guestFormHTML);
    
    // Add event listener for remove button
    const newGuestForm = guestsContainer.lastElementChild;
    const removeBtn = newGuestForm.querySelector('.remove-guest-btn');
    removeBtn.addEventListener('click', () => {
      newGuestForm.remove();
      // Re-enable add button if we're back under the limit
      if (guestsContainer.querySelectorAll('.guest-form').length < 2) {
        addGuestBtn.disabled = false;
        addGuestBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    });
    
    // Disable add button if we've reached the limit
    if (guestsContainer.querySelectorAll('.guest-form').length >= 2) {
      addGuestBtn.disabled = true;
      addGuestBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  }
  
  function createHotelCard(hotel, index) {
    const name = hotel.name || 'Unknown Hotel';
    const address = hotel.address || '';
    const city = hotel.city || '';
    const stars = hotel.stars ? '⭐'.repeat(Math.min(hotel.stars, 5)) : '';
    const rating = hotel.rating && hotel.rating > 0 ? `${hotel.rating}/10` : '';
    const reviews = hotel.reviewCount ? `(${hotel.reviewCount} reviews)` : '';
    const currency = hotel.currency || 'GBP';
    const photo = hotel.thumbnail || hotel.main_photo || '';
    const description = hotel.hotelDescription || hotel.description || hotel.summary || '';
    
    return `
      <div class="hotel-card ${index === 0 ? 'active' : ''}" data-index="${index}">
        <div class="hotel-card-inner">
          ${photo ? `
            <div class="hotel-image-container">
              <img src="${photo}" alt="${name}" class="hotel-image">
              <div class="hotel-overlay">
                <div class="hotel-rating">
                  ${stars}
                  ${rating ? `<span class="rating-score">${rating}</span>` : ''}
                </div>
              </div>
            </div>
          ` : `
            <div class="hotel-placeholder">
              <span class="hotel-icon">🏨</span>
            </div>
          `}
          
          <div class="hotel-content">
            <div class="hotel-header">
              <h4 class="hotel-name">${name}</h4>
              <span class="hotel-currency">${currency}</span>
            </div>
            
            ${address ? `<p class="hotel-address">${address}${city ? `, ${city}` : ''}</p>` : ''}
            
            ${description ? `<p class="hotel-description">${description.substring(0, 120)}${description.length > 120 ? '...' : ''}</p>` : ''}
            
            <div class="hotel-footer">
              ${reviews ? `<span class="hotel-reviews">${reviews}</span>` : ''}
              <button class="hotel-details-btn">View Details →</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  function setupHotelNavigation() {
    console.log('Setting up hotel navigation...');
    const stack = document.getElementById('hotels-stack');
    const prevBtn = document.getElementById('prev-hotel');
    const nextBtn = document.getElementById('next-hotel');
    const counter = document.getElementById('hotel-counter');
    
    console.log('Navigation elements:', { stack, prevBtn, nextBtn });
    
    function updateStack() {
      const cards = document.querySelectorAll('.hotel-card');
      
      console.log(`Updating stack: currentIndex=${currentHotelIndex}, cards=${cards.length}`);
      
      cards.forEach((card, index) => {
        if (index === currentHotelIndex) {
          // Active card - front and center
          card.style.transform = 'translateX(0px) translateY(0px) scale(1)';
          card.style.opacity = '1';
          card.style.zIndex = '10';
        } else if (index < currentHotelIndex) {
          // Cards behind - move left and scale down
          card.style.transform = `translateX(-${(currentHotelIndex - index) * 20}px) translateY(${(currentHotelIndex - index) * 10}px) scale(${1 - (currentHotelIndex - index) * 0.05})`;
          card.style.opacity = '0.6';
          card.style.zIndex = String(10 - (currentHotelIndex - index));
        } else {
          // Cards ahead - stack with offset
          card.style.transform = `translateX(${(index - currentHotelIndex) * 3}px) translateY(${(index - currentHotelIndex) * 2}px) scale(${1 - (index - currentHotelIndex) * 0.015})`;
          card.style.opacity = '0.8';
          card.style.zIndex = String(10 - (index - currentHotelIndex));
        }
      });
      
      if (counter) {
        counter.textContent = `Viewing ${currentHotelIndex + 1} of ${hotelCards.length} hotels`;
      }
      
      if (prevBtn) prevBtn.disabled = currentHotelIndex === 0;
      if (nextBtn) nextBtn.disabled = currentHotelIndex === hotelCards.length - 1;
    }
    
    prevBtn?.addEventListener('click', () => {
      console.log('Previous button clicked');
      if (currentHotelIndex > 0) {
        currentHotelIndex--;
        updateStack();
      }
    });
    
    nextBtn?.addEventListener('click', () => {
      console.log('Next button clicked');
      if (currentHotelIndex < hotelCards.length - 1) {
        currentHotelIndex++;
        updateStack();
      }
    });
    
    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        currentHotelIndex = index;
        updateStack();
      });
    });
    
    // Add swipe functionality
    setupSwipeGestures(stack, updateStack);
    
    // Initial setup
    updateStack();
  }

  function setupSwipeGestures(container, updateCallback) {
    if (!container) return;
    
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let isDragging = false;
    let startTime = 0;
    
    const SWIPE_THRESHOLD = 50; // Minimum distance for swipe
    const SWIPE_VELOCITY_THRESHOLD = 0.3; // Minimum velocity (pixels/ms)
    const MAX_VERTICAL_DEVIATION = 100; // Maximum vertical movement allowed
    
    // Navigation functions
    function goToPrevious() {
      if (currentHotelIndex > 0) {
        currentHotelIndex--;
        updateCallback();
        return true;
      }
      return false;
    }
    
    function goToNext() {
      if (currentHotelIndex < hotelCards.length - 1) {
        currentHotelIndex++;
        updateCallback();
        return true;
      }
      return false;
    }
    
    // Touch Events
    container.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      currentX = startX;
      currentY = startY;
      isDragging = true;
      startTime = Date.now();
      
      // Prevent default scrolling behavior
      e.preventDefault();
    }, { passive: false });
    
    container.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      
      const touch = e.touches[0];
      currentX = touch.clientX;
      currentY = touch.clientY;
      
      // Calculate deltas
      const deltaX = currentX - startX;
      const deltaY = Math.abs(currentY - startY);
      
      // If vertical movement is too much, cancel the swipe
      if (deltaY > MAX_VERTICAL_DEVIATION) {
        isDragging = false;
        return;
      }
      
      // Provide visual feedback during swipe
      const activeCard = container.querySelector('.hotel-card.active');
      if (activeCard && Math.abs(deltaX) > 10) {
        const translateAmount = deltaX * 0.3; // Dampened movement
        activeCard.style.transform = `translateX(${translateAmount}px) scale(1)`;
        activeCard.style.transition = 'none'; // Disable transition during drag
      }
      
      e.preventDefault();
    }, { passive: false });
    
    container.addEventListener('touchend', (e) => {
      if (!isDragging) return;
      
      const endTime = Date.now();
      const deltaX = currentX - startX;
      const deltaY = Math.abs(currentY - startY);
      const deltaTime = endTime - startTime;
      const velocity = Math.abs(deltaX) / deltaTime;
      
      // Reset visual feedback
      const activeCard = container.querySelector('.hotel-card.active');
      if (activeCard) {
        activeCard.style.transform = '';
        activeCard.style.transition = '';
      }
      
      // Determine if this was a valid swipe
      const isValidSwipe = Math.abs(deltaX) > SWIPE_THRESHOLD && 
                          deltaY < MAX_VERTICAL_DEVIATION &&
                          (velocity > SWIPE_VELOCITY_THRESHOLD || Math.abs(deltaX) > SWIPE_THRESHOLD * 2);
      
      if (isValidSwipe) {
        if (deltaX > 0) {
          // Swipe right - go to previous
          goToPrevious();
        } else {
          // Swipe left - go to next
          goToNext();
        }
      }
      
      isDragging = false;
      e.preventDefault();
    }, { passive: false });
    
    // Mouse Events (for desktop)
    container.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startY = e.clientY;
      currentX = startX;
      currentY = startY;
      isDragging = true;
      startTime = Date.now();
      
      // Prevent text selection
      e.preventDefault();
    });
    
    container.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      currentX = e.clientX;
      currentY = e.clientY;
      
      const deltaX = currentX - startX;
      const deltaY = Math.abs(currentY - startY);
      
      if (deltaY > MAX_VERTICAL_DEVIATION) {
        isDragging = false;
        return;
      }
      
      // Visual feedback for mouse drag
      const activeCard = container.querySelector('.hotel-card.active');
      if (activeCard && Math.abs(deltaX) > 5) {
        const translateAmount = deltaX * 0.3;
        activeCard.style.transform = `translateX(${translateAmount}px) scale(1)`;
        activeCard.style.transition = 'none';
        container.style.cursor = 'grabbing';
      }
    });
    
    container.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      
      const endTime = Date.now();
      const deltaX = currentX - startX;
      const deltaY = Math.abs(currentY - startY);
      const deltaTime = endTime - startTime;
      const velocity = Math.abs(deltaX) / deltaTime;
      
      // Reset visual feedback
      const activeCard = container.querySelector('.hotel-card.active');
      if (activeCard) {
        activeCard.style.transform = '';
        activeCard.style.transition = '';
      }
      container.style.cursor = '';
      
      const isValidSwipe = Math.abs(deltaX) > SWIPE_THRESHOLD && 
                          deltaY < MAX_VERTICAL_DEVIATION &&
                          (velocity > SWIPE_VELOCITY_THRESHOLD || Math.abs(deltaX) > SWIPE_THRESHOLD * 1.5);
      
      if (isValidSwipe) {
        if (deltaX > 0) {
          goToPrevious();
        } else {
          goToNext();
        }
      }
      
      isDragging = false;
    });
    
    // Handle mouse leave to reset state
    container.addEventListener('mouseleave', () => {
      if (isDragging) {
        const activeCard = container.querySelector('.hotel-card.active');
        if (activeCard) {
          activeCard.style.transform = '';
          activeCard.style.transition = '';
        }
        container.style.cursor = '';
        isDragging = false;
      }
    });
    
    // Add cursor styles
    container.style.cursor = 'grab';
    container.style.userSelect = 'none';
    
    console.log('Swipe gestures enabled for hotel cards');
  }

  // Setup prebooking modal handlers
  function setupPrebookingModal() {
    const modal = document.getElementById('prebooking-modal');
    const closeBtn = document.getElementById('close-prebooking');
    const cancelBtn = document.getElementById('cancel-booking');
    const confirmBtn = document.getElementById('confirm-booking');
    const addGuestBtn = document.getElementById('add-guest-btn');
    
    // Close modal handlers
    [closeBtn, cancelBtn].forEach(btn => {
      btn?.addEventListener('click', () => {
        modal.classList.add('hidden');
      });
    });
    
    // Close on background click
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
    
    // Add guest button handler
    addGuestBtn?.addEventListener('click', () => {
      addGuestForm();
    });
    
    // Helper function to reset button state
    function resetBookingButton() {
      const originalText = '<div class="flex items-center justify-center space-x-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg><span>Complete Booking</span></div>';
      confirmBtn.innerHTML = originalText;
      confirmBtn.disabled = false;
      confirmBtn.className = 'w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200';
    }

    // Confirm booking handler
    confirmBtn?.addEventListener('click', async () => {
      const originalText = confirmBtn.innerHTML;
      confirmBtn.innerHTML = '<svg class="w-4 h-4 inline mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Processing...';
      confirmBtn.disabled = true;
      
      try {
        const prebookData = window.currentPrebookData;
        
        if (!prebookData || prebookData.isDemo) {
          // Demo booking - just simulate
          await new Promise(resolve => setTimeout(resolve, 2000));
          confirmBtn.innerHTML = '<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Demo Booking Complete!';
        } else {
          // Real booking via API
          console.log('Confirming booking for prebook ID:', prebookData.prebookId);
          
          // Collect holder information from form
          const holder = {
            firstName: document.getElementById('holder-firstname').value.trim(),
            lastName: document.getElementById('holder-lastname').value.trim(),
            email: document.getElementById('holder-email').value.trim(),
            phone: document.getElementById('holder-phone').value.trim()
          };
          
          // Validate holder information
          if (!holder.firstName || !holder.lastName || !holder.email || !holder.phone) {
            throw new Error('Please fill in all holder information fields');
          }
          
          // Collect guest information
          const guests = [];
          const guestForms = document.querySelectorAll('.guest-form');
          
          guestForms.forEach((form, index) => {
            const guestData = {
              occupancyNumber: index + 1,
              firstName: form.querySelector('.guest-firstname').value.trim(),
              lastName: form.querySelector('.guest-lastname').value.trim(),
              email: form.querySelector('.guest-email').value.trim(),
              phone: form.querySelector('.guest-phone').value.trim(),
              remarks: form.querySelector('.guest-remarks').value.trim() || ''
            };
            
            // Validate guest information (at least first guest is required)
            if (index === 0 && (!guestData.firstName || !guestData.lastName || !guestData.email || !guestData.phone)) {
              throw new Error('Please fill in all information for Guest 1 (Primary)');
            }
            
            // Only add guest if they have required fields filled
            if (guestData.firstName && guestData.lastName && guestData.email && guestData.phone) {
              guests.push(guestData);
            }
          });
          
          // Ensure we have at least one guest
          if (guests.length === 0) {
            throw new Error('At least one guest is required');
          }
          
          // Use simple transaction ID method for payment
          const bookingPayload = {
            holder: holder,
            guests: guests,
            prebookId: prebookData.prebookId,
            payment: {
              method: 'ACC_CREDIT_CARD'
              // transactionId: 'gmd_' + Math.random().toString(36).substr(2, 16)
            }
          };
          
          console.log('Booking payload:', bookingPayload);
          
          const bookingResponse = await fetch('http://localhost:3000/api/book', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(bookingPayload)
          });
          

          // MAKE THE BOOKING API HERE
          if (!bookingResponse.ok) {
            const errorData = await bookingResponse.json().catch(() => ({}));
            throw new Error(`Booking failed: ${errorData.error || 'Unknown error'}`);
          }
          
          const bookingResult = await bookingResponse.json();
          console.log('Booking confirmed:', bookingResult);
          
          // Store booking in local storage with event details
          const eventDetails = await getCurrentEventDetails();
          const fullHotelData = window.currentHotelData;
          const hotelName = window.currentHotelName;
          const hotelPrice = window.currentHotelPrice;
          
          console.log('prebookData:', prebookData);
          console.log('fullHotelData:', fullHotelData);
          console.log('hotelName:', hotelName);
          
          await saveBookingToStorage(bookingResult, prebookData, holder, guests, eventDetails, {
            hotelData: fullHotelData,
            hotelName: hotelName,
            hotelPrice: hotelPrice
          });
          
          confirmBtn.innerHTML = '<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Booking Confirmed!';
        }
        
        confirmBtn.className = 'w-full bg-green-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg';
        
        // Auto-close modal after success
        setTimeout(() => {
          modal.classList.add('hidden');
          resetBookingButton();
        }, 2000);
        
      } catch (error) {
        console.error('Booking confirmation error:', error);
        
        // Show error state
        confirmBtn.innerHTML = '<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Booking Failed';
        confirmBtn.className = 'w-full bg-red-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg';
        
        // Reset after 3 seconds
        setTimeout(() => {
          confirmBtn.innerHTML = originalText;
          confirmBtn.disabled = false;
          confirmBtn.className = 'w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200';
        }, 3000);
      }
    });
  }

  // All Bookings Button Handler
  const allBookingsBtn = document.getElementById('all-bookings-btn');
  allBookingsBtn?.addEventListener('click', () => {
    chrome.tabs.create({ 
      url: chrome.runtime.getURL('all-bookings.html')
    });
  });

  // Initialize
  setupRadiusFilter();
  setupPrebookingModal();
  await Promise.all([
    loadEventData(),
    checkApiStatus()
  ]);
  
  // Check for existing booking for this event
  const existingBooking = await checkForExistingBooking();
  if (existingBooking) {
    showBookingView(existingBooking);
  }
});

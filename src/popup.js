document.addEventListener('DOMContentLoaded', async function() {
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
    generateBtn.disabled = true;
    generateBtn.classList.add('opacity-50', 'cursor-not-allowed');
  }

  function displayEventData(eventData) {
    loadingDiv.classList.add('hidden');
    noEventDiv.classList.add('hidden');
    eventDetailsDiv.classList.remove('hidden');
    
    currentEventData = eventData;
    eventTitle.textContent = eventData.title || 'Event Title Not Found';
    eventDate.textContent = eventData.date || 'Date Not Found';
    eventLocation.textContent = eventData.location || 'Location Not Found';
    
    generateBtn.disabled = false;
    generateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
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
        
        // No fallback - show error instead
        hotelData = { data: [] };
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
      // Show quick results first (top 3 hotels)
      displayQuickResults(hotels.slice(0, 3));
      
      // Prepare detailed view
      prepareDetailedView(hotels);
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
  }

  function setupQuickBooking() {
    // One-click booking buttons
    document.querySelectorAll('.book-now-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const hotelName = this.dataset.hotelName;
        const hotelPrice = this.dataset.hotelPrice;
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
    // Show loading state
    const originalText = button.innerHTML;
    button.innerHTML = '<svg class="w-3 h-3 inline mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Loading...';
    button.disabled = true;
    
    try {
      // Get the hotel data to find the rate ID
      const hotelData = findHotelByName(hotelName);
      if (!hotelData || !hotelData.rateId) {
        throw new Error('Hotel rate information not found');
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
    if (!hotelCards || hotelCards.length === 0) return null;
    
    const hotel = hotelCards.find(h => h.name === hotelName);
    if (hotel && hotel.pricing && hotel.pricing.rateId) {
      return {
        ...hotel,
        rateId: hotel.pricing.rateId
      };
    }
    return null;
  }

  async function showPrebookingModal(bookingDetails) {
    const modal = document.getElementById('prebooking-modal');
    const { hotelName, prebookingData, hotelPrice } = bookingDetails;
    
    // Store prebook data for later booking confirmation
    window.currentPrebookData = prebookingData;
    
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
          
          // Get payment method
          const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'TRANSACTION_ID';
          
          const bookingPayload = {
            holder: holder,
            payment: {
              method: paymentMethod,
              transactionId: 'gmd_' + Math.random().toString(36).substr(2, 16) // Generate temporary transaction ID
            },
            guests: guests,
            prebookId: prebookData.prebookId
          };
          
          console.log('Booking payload:', bookingPayload);
          
          const bookingResponse = await fetch('http://localhost:3000/api/book', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(bookingPayload)
          });
          
          if (!bookingResponse.ok) {
            throw new Error(`Booking failed: ${bookingResponse.status}`);
          }
          
          const bookingResult = await bookingResponse.json();
          console.log('Booking confirmed:', bookingResult);
          
          confirmBtn.innerHTML = '<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Booking Confirmed!';
        }
        
        confirmBtn.className = 'w-full bg-green-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg';
        
        // Auto-close modal after success
        setTimeout(() => {
          modal.classList.add('hidden');
          confirmBtn.innerHTML = originalText;
          confirmBtn.disabled = false;
          confirmBtn.className = 'w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200';
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

  // Initialize
  setupRadiusFilter();
  setupPrebookingModal();
  await Promise.all([
    loadEventData(),
    checkApiStatus()
  ]);
});

document.addEventListener('DOMContentLoaded', async function() {
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
    generateBtn.textContent = '⏳ Finding Hotels...';
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
            radius: 3000 // 1km radius
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
          <p class="text-xs text-red-500 mb-2 font-medium">❌ Error fetching hotels</p>
          <div class="bg-red-50 rounded-lg p-3 text-sm border border-red-200">
            <p class="text-red-700 font-medium">Failed to connect to hotel service. Make sure the backend server is running on localhost:3000</p>
            <p class="text-red-600 text-xs mt-1">Error: ${error.message}</p>
          </div>
        </div>
      `;
    } finally {
      generateBtn.textContent = '✨ Generate Stay Plan';
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
    
    if (hotels.length > 0) {
      // Show quick results first (top 3 hotels)
      displayQuickResults(hotels.slice(0, 3));
      
      // Prepare detailed view
      prepareDetailedView(hotels);
    } else {
      document.getElementById('quick-results').innerHTML = `
        <div class="bg-white rounded-2xl p-6 text-center border border-slate-200/50">
          <div class="text-4xl mb-3">🏨</div>
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
                  <span class="text-2xl">🏨</span>
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
                  <span>⭐</span>
                </div>
              </div>
              
              <div class="flex items-center space-x-3 text-xs text-slate-600 mb-2">
                <span class="flex items-center">
                  <span class="mr-1">📍</span>
                  ${distance}
                </span>
                ${roomInfo ? `
                  <span class="flex items-center">
                    <span class="mr-1">🍽️</span>
                    ${roomInfo}
                  </span>
                ` : `
                  <span class="flex items-center">
                    <span class="mr-1">🚗</span>
                    Free parking
                  </span>
                `}
              </div>
              
              <div class="flex items-end justify-between">
                <div>
                  <p class="text-xs text-slate-500">${hotel.pricing ? 'Per night from' : 'Est. per night'}</p>
                  <p class="font-black text-slate-900 text-lg">${price}</p>
                  ${hotel.pricing && hotel.pricing.checkin && hotel.pricing.checkout ? `
                    <p class="text-xs text-slate-400">${hotel.pricing.checkin} - ${hotel.pricing.checkout}</p>
                  ` : ''}
                </div>
                
                <!-- One-Click Book Button -->
                <button class="book-now-btn bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-bold px-4 py-2 rounded-xl text-sm shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                        data-hotel-name="${name}" data-hotel-price="${price}">
                  📅 Book Now
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
          <span>🔍</span>
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
                  <span class="text-xl text-white">🏨</span>
                </div>
              </div>
            `}
            
            <div class="absolute top-2 right-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-2 py-1 rounded-xl text-xs font-black shadow-sm">
              ${rating}⭐
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
                  <span class="text-xs">🏊</span>
                </div>
                <div class="w-5 h-5 bg-green-100 rounded-lg flex items-center justify-center">
                  <span class="text-xs">🚗</span>
                </div>
                <div class="w-5 h-5 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span class="text-xs">📶</span>
                </div>
                <div class="w-5 h-5 bg-orange-100 rounded-lg flex items-center justify-center">
                  <span class="text-xs">☕</span>
                </div>
              </div>
              
              <div class="flex items-center justify-between mb-3">
                <div>
                  <p class="text-xs text-slate-500 font-medium">${hotel.pricing ? 'Per night' : 'Est. per night'}</p>
                  <p class="font-black text-slate-900 text-lg">${price}</p>
                  ${hotel.pricing && hotel.pricing.boardName ? `
                    <p class="text-xs text-green-600 font-medium">${hotel.pricing.boardName}</p>
                  ` : ''}
                </div>
              </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="flex gap-2 mt-auto">
              <button class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl font-bold text-xs transition-all duration-200 hover:scale-105">
                More Info
              </button>
              <button class="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-3 py-2 rounded-xl font-bold text-xs transition-all duration-200 hover:scale-105 shadow-lg book-detailed-btn"
                      data-hotel-name="${name}" data-hotel-price="${price}">
                Book Now
              </button>
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
      setupHotelNavigation();
    });

    // Close detailed view button
    document.getElementById('close-detailed')?.addEventListener('click', function() {
      document.getElementById('detailed-view').classList.add('hidden');
    });
  }

  function handleQuickBooking(hotelName, hotelPrice, button) {
    // Simulate booking process
    const originalText = button.innerHTML;
    button.innerHTML = '⏳ Booking...';
    button.disabled = true;
    
    setTimeout(() => {
      button.innerHTML = '✅ Booked!';
      button.className = 'bg-green-500 text-white font-bold px-4 py-2 rounded-xl text-sm shadow-md';
      
      // Show success message
      const card = button.closest('.bg-white');
      card.style.transform = 'scale(0.98)';
      card.style.opacity = '0.7';
      
      // Reset after 2 seconds
      setTimeout(() => {
        button.innerHTML = originalText;
        button.disabled = false;
        button.className = 'book-now-btn bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-bold px-4 py-2 rounded-xl text-sm shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200';
        card.style.transform = '';
        card.style.opacity = '';
      }, 2000);
    }, 1000);
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

  // Initialize
  await Promise.all([
    loadEventData(),
    checkApiStatus()
  ]);
});

document.addEventListener('DOMContentLoaded', async function() {
  const generateBtn = document.getElementById('generate-btn');
  const loadingDiv = document.getElementById('loading');
  const noEventDiv = document.getElementById('no-event');
  const eventDetailsDiv = document.getElementById('event-details');
  const resultsSection = document.getElementById('results-section');
  
  const eventTitle = document.getElementById('event-title');
  const eventDate = document.getElementById('event-date');
  const eventLocation = document.getElementById('event-location');

  let currentEventData = null;

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
      console.log('Sending location to API:', currentEventData.location);
      
      // Call the hotels API
      const response = await fetch('http://localhost:3000/api/hotels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: currentEventData.location,
          checkin: currentEventData.date || new Date().toISOString().split('T')[0],
          nights: 2
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const hotelData = await response.json();
      console.log('Hotel API response:', hotelData);
      
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

  function displayHotelResults(hotelData) {
    resultsSection.classList.remove('hidden');
    
    let hotelsHtml = '';
    if (hotelData.success && hotelData.hotels) {
      // Handle different possible response formats
      const hotels = hotelData.hotels.data || hotelData.hotels.results || hotelData.hotels || [];
      
      if (hotels.length > 0) {
        hotelsHtml = hotels.slice(0, 3).map(hotel => {
          const name = hotel.name || hotel.hotelName || hotel.hotel_name || 'Unknown Hotel';
          const price = hotel.price || hotel.rate || hotel.price_per_night || '';
          const url = hotel.booking_url || hotel.url || hotel.link || '#';
          
          return `
            <div class="bg-white rounded-lg p-3 mb-2 border border-gray-200">
              <h4 class="font-semibold text-black">${name}</h4>
              ${price ? `<p class="text-sm text-gray-600">From ${price}</p>` : ''}
              <a href="${url}" target="_blank" class="text-xs text-blue-600 hover:underline">View Details →</a>
            </div>
          `;
        }).join('');
      } else {
        hotelsHtml = '<p class="text-sm text-gray-600">No hotels found for this location.</p>';
      }
    } else {
      hotelsHtml = '<p class="text-sm text-red-600">Error: Unable to fetch hotel data.</p>';
    }
    
    resultsSection.innerHTML = `
      <div class="mt-4 pt-3 border-t border-gray-200">
        <p class="text-xs text-gray-500 mb-2 font-medium">🏨 Hotels near ${currentEventData.location}</p>
        <div class="space-y-2">
          ${hotelsHtml}
        </div>
      </div>
    `;
  }

  // Initialize
  await loadEventData();
});

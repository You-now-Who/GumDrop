// Content script for scraping Eventbrite event details
(function() {
  'use strict';

  console.log('Gumdrop content script loaded on:', window.location.href);
  
  async function getStoredBookings() {
    try {
      const result = await chrome.storage.local.get(['gumdrop_bookings']);
      return result.gumdrop_bookings || [];
    } catch (error) {
      console.error('Error retrieving bookings:', error);
      return [];
    }
  }

  let lastScrapedData = null;
  let storedBookings = [];

  // Function to scrape event details from Eventbrite page
  function scrapeEventDetails() {
    console.log('Scraping event details...');
    
    const eventData = {
      title: null,
      date: null,
      location: null,
      url: window.location.href,
      ticketPrice: null,
      currency: null
    };

    // Try multiple selectors for event title
    const titleSelectors = [
      'h1[data-testid="event-title"]',
      'h1.event-title',
      '.event-hero__title h1',
      '.listing-hero-title',
      'h1',
      '[class*="title"]'
    ];

    for (const selector of titleSelectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement && titleElement.textContent.trim()) {
        eventData.title = titleElement.textContent.trim();
        break;
      }
    }

    // Try multiple selectors for event date
    const dateSelectors = [
      'location-info__address-text',
      '[data-testid="event-date"]',
      '.event-details__date',
      '.event-hero__date',
      '.listing-hero-date',
      '[class*="date"]',
      'time'
    ];

    for (const selector of dateSelectors) {
      const dateElement = document.querySelector(selector);
      if (dateElement && dateElement.textContent.trim()) {
        eventData.date = dateElement.textContent.trim();
        break;
      }
    }

    // Try to get location from the specific Eventbrite structure
    const locationContainer = document.querySelector('.location-info__address');
    if (locationContainer) {
      console.log("Found location container:", locationContainer);
      
      // Get venue name from the nested p tag
      const venueElement = locationContainer.querySelector('.location-info__address-text');
      let venue = '';
      if (venueElement) {
        venue = venueElement.textContent.trim();
        console.log("Found venue:", venue);
      }
      
      // Get ONLY the direct text content of the location container, excluding child elements
      let directText = '';
      for (let node of locationContainer.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          directText += node.textContent;
        }
      }
      directText = directText.trim().replace(/\s+/g, ' ');
      
      console.log("Direct text from location container:", directText);
      
      // Store the direct text as address
      if (directText) {
        eventData.address = directText;
      }
      
      // Combine venue and address for location
      if (venue && directText) {
        eventData.location = `${venue}, ${directText}`;
      } else if (venue) {
        eventData.location = venue;
      } else if (directText) {
        eventData.location = directText;
      }
      
      console.log("Final location:", eventData.location);
      console.log("Stored address:", eventData.address);
    }

    // Scrape ticket prices
    console.log('Scraping ticket prices...');
    const priceSelectors = [
      '.eds-text-weight--heavy[data-testid*="price"]',
      '[data-testid="price-display"]',
      '.ticket-card__price',
      '.event-card-details__price',
      '.price-display',
      '.ticket-price',
      '[class*="price"]:not([class*="price-range"])',
      'span[contains(class, "price")]',
      '.conversion-bar__panel-info .eds-text-weight--heavy'
    ];

    for (const selector of priceSelectors) {
      const priceElements = document.querySelectorAll(selector);
      console.log(`Checking price selector: ${selector}, found ${priceElements.length} elements`);
      
      for (const element of priceElements) {
        const text = element.textContent.trim();
        console.log(`Price element text: "${text}"`);
        
        // Look for price patterns (£, $, €, etc. followed by numbers)
        const priceMatch = text.match(/([£$€¥₹])(\d+(?:\.\d{2})?)|(\d+(?:\.\d{2})?)\s*([£$€¥₹])/);
        if (priceMatch) {
          const currency = priceMatch[1] || priceMatch[4];
          const amount = parseFloat(priceMatch[2] || priceMatch[3]);
          
          console.log(`Found price: ${currency}${amount}`);
          
          // Skip if it's 0 (free event)
          if (amount > 0) {
            eventData.ticketPrice = amount;
            eventData.currency = currency;
            console.log(`Ticket price set: ${currency}${amount}`);
            
            // Inject hotel price below this element
            injectHotelPriceBelow(element, eventData);
            break;
          }
        }
      }
      
      if (eventData.ticketPrice) break;
    }

    // If no price found, look for "Free" indicators
    if (!eventData.ticketPrice) {
      const freeSelectors = [
        '[data-testid*="free"]',
        '.ticket-card:contains("Free")',
        '.price-display:contains("Free")',
        '*[class*="price"]:contains("Free")'
      ];
      
      for (const selector of freeSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.toLowerCase().includes('free')) {
          eventData.ticketPrice = 0;
          eventData.currency = '£'; // Default currency
          console.log('Event identified as free');
          
          // Inject hotel price below this element for free events too
          injectHotelPriceBelow(element, eventData);
          break;
        }
      }
    }

    // Fallback: check for any text containing price patterns anywhere on the page
    if (!eventData.ticketPrice) {
      const allText = document.body.textContent;
      const priceMatches = allText.match(/(?:from\s+|starting\s+at\s+|price[:\s]+)?([£$€¥₹])(\d+(?:\.\d{2})?)/gi);
      if (priceMatches && priceMatches.length > 0) {
        // Take the first reasonable price found
        for (const match of priceMatches) {
          const cleanMatch = match.match(/([£$€¥₹])(\d+(?:\.\d{2})?)/);
          if (cleanMatch) {
            const amount = parseFloat(cleanMatch[2]);
            if (amount > 0 && amount < 1000) { // Reasonable price range
              eventData.ticketPrice = amount;
              eventData.currency = cleanMatch[1];
              console.log(`Fallback price found: ${cleanMatch[1]}${amount}`);
              
              // Try to find the price element to inject below (this is a fallback so might not work perfectly)
              const priceElements = document.querySelectorAll('*');
              for (const el of priceElements) {
                if (el.textContent.includes(cleanMatch[0])) {
                  injectHotelPriceBelow(el, eventData);
                  break;
                }
              }
              break;
            }
          }
        }
      }
    }
    
    // Fallback selectors if the above doesn't work
    if (!eventData.location) {
      const fallbackSelectors = [
        '.event-details__location',
        '.event-hero__location', 
        '.listing-hero-location',
        '[class*="location"]',
        '[class*="venue"]',
      ];

      for (const selector of fallbackSelectors) {
        const locationElement = document.querySelector(selector);
        console.log("Trying fallback selector", selector);
        if (locationElement && locationElement.textContent.trim()) {
          console.debug("Fallback selector worked: ", selector);
          eventData.location = locationElement.textContent.trim();
          break;
        }
      }
    }
    

    // Fallback: look for structured data
    if (!eventData.title || !eventData.date || !eventData.location) {
      const structuredData = document.querySelector('script[type="application/ld+json"]');
      if (structuredData) {
        try {
          const data = JSON.parse(structuredData.textContent);
          if (data['@type'] === 'Event') {
            eventData.title = eventData.title || data.name;
            eventData.date = eventData.date || (data.startDate || data.doorTime);
            if (!eventData.location){
              eventData.location = eventData.location || (data.location?.name || data.location?.address?.addressLocality);
            }
          }
        } catch (e) {
          console.log('Failed to parse structured data:', e);
        }
      }
    }

    // Clean up the data
    if (eventData.title) {
      eventData.title = eventData.title.replace(/\s+/g, ' ').trim();
    }
    if (eventData.date) {
      eventData.date = eventData.date.replace(/\s+/g, ' ').trim();
    }
    if (eventData.location) {
      eventData.location = eventData.location.replace(/\s+/g, ' ').trim();
    }
    if (eventData.address) {
      eventData.address = eventData.address.replace(/\s+/g, ' ').trim();
    }

    console.log('Scraped event data:', eventData);
    return eventData;
  }

  // Function to inject hotel price below the event price
  async function injectHotelPriceBelow(priceElement, eventData) {
    // Check if we already injected the hotel price
    if (priceElement.nextElementSibling?.classList?.contains('gumdrop-hotel-price')) {
      return;
    }

    console.log('Injecting hotel price below event price...');
    
    // Create the hotel price container
    const hotelContainer = document.createElement('div');
    hotelContainer.className = 'gumdrop-hotel-price';
    hotelContainer.style.cssText = `
      background: linear-gradient(135deg, #fffef7 0%, #fef9e7 100%);
      color: #1f2937;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      margin-top: 10px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: 250px;
      transition: all 0.2s ease;
      user-select: none;
      letter-spacing: 0.5px;
      border: 2px dotted #fbbf24;
    `;
    
    hotelContainer.innerHTML = `
      <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
      </svg>
      <span id="gumdrop-hotel-text">Finding hotels...</span>
      <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24" style="margin-left: auto; opacity: 0.8;">
        <path d="M9 5l7 7-7 7"/>
      </svg>
    `;

    // Add click handler to open extension popup
    hotelContainer.style.cursor = 'pointer';
    hotelContainer.title = 'Click to open Gumdrop and book hotels';
    
    hotelContainer.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Send message to background script to open popup
      chrome.runtime.sendMessage({ 
        action: 'openPopup',
        source: 'injected-price-badge'
      });
      
      // Add click animation
      hotelContainer.style.transform = 'scale(0.95)';
      setTimeout(() => {
        hotelContainer.style.transform = 'scale(1)';
      }, 150);
    });

    // Add hover effects
    hotelContainer.addEventListener('mouseenter', () => {
      hotelContainer.style.transform = 'scale(1.05)';
      hotelContainer.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.3)';
      hotelContainer.style.background = 'linear-gradient(135deg, #fef9e7 0%, #fef3c7 100%)';
      hotelContainer.style.border = '2px dotted #f59e0b';
    });

    hotelContainer.addEventListener('mouseleave', () => {
      hotelContainer.style.transform = 'scale(1)';
      hotelContainer.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
      hotelContainer.style.background = 'linear-gradient(135deg, #fffef7 0%, #fef9e7 100%)';
      hotelContainer.style.border = '2px dotted #fbbf24';
    });

    // Insert after the price element
    priceElement.parentNode.insertBefore(hotelContainer, priceElement.nextSibling);

    // Fetch cheapest hotel price
    try {
      await fetchAndDisplayCheapestHotel(eventData, hotelContainer);
    } catch (error) {
      console.error('Error fetching hotel prices:', error);
      const textElement = hotelContainer.querySelector('#gumdrop-hotel-text');
      textElement.textContent = 'Hotels available';
    }
  }

  // Function to fetch cheapest hotel and display price
  async function fetchAndDisplayCheapestHotel(eventData, container) {
    const textElement = container.querySelector('#gumdrop-hotel-text');
    
    try {
      console.log('Fetching hotels for:', eventData.location);
      
      // Step 1: Get list of hotels
      const hotelsResponse = await fetch('http://localhost:3000/api/hotels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: eventData.location,
          address: eventData.address,
          radius: 3000 // 3km radius
        })
      });

      if (!hotelsResponse.ok) {
        throw new Error('Hotels API failed');
      }

      const hotelsData = await hotelsResponse.json();
      
      if (!hotelsData.data || hotelsData.data.length === 0) {
        textElement.textContent = 'No hotels found';
        return;
      }

      console.log(`Found ${hotelsData.data.length} hotels, getting prices...`);
      textElement.textContent = 'Getting prices...';

      // Step 2: Get pricing for hotels
      const hotelIds = hotelsData.data.slice(0, 10).map(hotel => hotel.id); // Limit to first 10 hotels
      
      const pricingResponse = await fetch('http://localhost:3000/api/hotels_details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelIds: hotelIds,
          eventDate: eventData.date
        })
      });

      console.log('Pricing API response status:', pricingResponse.status);

      if (!pricingResponse.ok) {
        const errorText = await pricingResponse.text();
        console.error('Pricing API error response:', errorText);
        throw new Error(`Pricing API failed: ${pricingResponse.status} - ${errorText}`);
      }

      const pricingData = await pricingResponse.json();
      console.log('Raw pricing response:', JSON.stringify(pricingData, null, 2));
      
      // Find cheapest hotel
      let cheapestPrice = Infinity;
      let cheapestCurrency = '£';
      
      console.log('Processing pricing data:', pricingData);
      
      if (pricingData.data && pricingData.data.length > 0) {
        console.log(`Found ${pricingData.data.length} hotels with pricing data`);
        
        pricingData.data.forEach((hotelPricing, hotelIndex) => {
          console.log(`Hotel ${hotelIndex + 1}:`, hotelPricing);
          
          if (hotelPricing.roomTypes && hotelPricing.roomTypes.length > 0) {
            console.log(`  Found ${hotelPricing.roomTypes.length} room types`);
            
            hotelPricing.roomTypes.forEach((room, roomIndex) => {
              console.log(`  Room ${roomIndex + 1}:`, room);
              
              if (room.offerRetailRate && room.offerRetailRate.amount) {
                const price = parseFloat(room.offerRetailRate.amount);
                console.log(`    Price found: ${room.offerRetailRate.currency} ${price}`);
                
                if (price < cheapestPrice) {
                  cheapestPrice = price;
                  cheapestCurrency = room.offerRetailRate.currency === 'GBP' ? '£' : 
                                   room.offerRetailRate.currency === 'USD' ? '$' : 
                                   room.offerRetailRate.currency === 'EUR' ? '€' : 
                                   room.offerRetailRate.currency;
                  console.log(`    New cheapest: ${cheapestCurrency}${cheapestPrice}`);
                }
              } else {
                console.log(`    No offer retail rate found for room ${roomIndex + 1}`);
              }
            });
          } else {
            console.log(`  No room types found for hotel ${hotelIndex + 1}`);
          }
        });
      } else {
        console.log('No pricing data found in response');
      }
      
      console.log(`Final cheapest price: ${cheapestCurrency}${cheapestPrice}`);

      if (cheapestPrice < Infinity) {
        textElement.textContent = `Stay from ${cheapestCurrency}${Math.round(cheapestPrice)}`;
        
        // Calculate total
        const totalPrice = eventData.ticketPrice + cheapestPrice;
        const sameCurrency = eventData.currency === cheapestCurrency;
        
        if (sameCurrency) {
          // Add total calculation below
          const totalElement = document.createElement('div');
          totalElement.style.cssText = `
            font-size: 14px;
            font-weight: 700;
            color: #1f2937;
            margin-top: 4px;
            letter-spacing: 0.3px;
            text-transform: uppercase;
          `;
          totalElement.textContent = `Total: ${cheapestCurrency}${Math.round(totalPrice)}`;
          container.appendChild(totalElement);
        }
        
        console.log(`Cheapest hotel: ${cheapestCurrency}${cheapestPrice}, Total: ${cheapestCurrency}${Math.round(totalPrice)}`);
      } else {
        console.log('No valid prices found, trying alternative pricing structure...');
        
        // Try alternative pricing structure
        let foundAlternativePrice = false;
        
        if (pricingData.data && pricingData.data.length > 0) {
          // Look for different pricing structure
          for (const hotel of pricingData.data) {
            // Check if there's a rates array directly
            if (hotel.rates && Array.isArray(hotel.rates)) {
              for (const rate of hotel.rates) {
                if (rate.retailRate && rate.retailRate.amount) {
                  const price = parseFloat(rate.retailRate.amount);
                  if (price > 0) {
                    textElement.textContent = `Stay from £${Math.round(price)}`;
                    foundAlternativePrice = true;
                    console.log(`Found alternative pricing: £${price}`);
                    break;
                  }
                }
              }
              if (foundAlternativePrice) break;
            }
            
            // Check for other possible structures
            if (hotel.price || hotel.amount) {
              const price = parseFloat(hotel.price || hotel.amount);
              if (price > 0) {
                textElement.textContent = `Stay from £${Math.round(price)}`;
                foundAlternativePrice = true;
                console.log(`Found direct price: £${price}`);
                break;
              }
            }
          }
        }
        
        if (!foundAlternativePrice) {
          textElement.textContent = 'Hotels available';
          console.log('No pricing found in any format');
        }
      }
      
    } catch (error) {
      console.error('Error in fetchAndDisplayCheapestHotel:', error);
      
      // Fallback to demo pricing with more realistic range
      const demoPrice = Math.floor(Math.random() * 100) + 80; // £80-£179
      textElement.textContent = `Stay from £${demoPrice}`;
      
      // Add demo total
      const totalElement = document.createElement('div');
      totalElement.style.cssText = `
        font-size: 14px;
        font-weight: 700;
        color: #1f2937;
        margin-top: 4px;
        letter-spacing: 0.3px;
        text-transform: uppercase;
      `;
      
      if (eventData.currency === '£') {
        const total = eventData.ticketPrice + demoPrice;
        totalElement.textContent = `Total: £${total}`;
      } else {
        totalElement.textContent = `Total: ${eventData.currency}${eventData.ticketPrice} + £${demoPrice}`;
      }
      container.appendChild(totalElement);
      
      console.log(`Using fallback demo pricing: £${demoPrice}`);
    }
  }

  // Function to cache event data
  function cacheEventData(eventData) {
    // Only cache if we have at least the title
    if (eventData.title) {
      console.log('Event data cached:', eventData);
      lastScrapedData = eventData;
    }
  }

  // Function to check if this looks like an event page
  function isEventPage() {
    const url = window.location.href;
    return url.includes('/e/') || url.includes('/events/');
  }

  // Main scraping function with retry mechanism
  function performScraping(retryCount = 0, maxRetries = 5, startTime = null) {
    if (!isEventPage()) {
      console.log('Not an event page, skipping scraping');
      return;
    }

    // Initialize start time on first call
    if (startTime === null) {
      startTime = Date.now();
    }

    // Check if we've exceeded 10 seconds
    const elapsed = Date.now() - startTime;
    if (elapsed > 10000) {
      console.log('Scraping timeout reached (10 seconds). Stopping attempts.');
      return;
    }

    const eventData = scrapeEventDetails();
    
    // Check if we got essential data
    const hasEssentialData = eventData.title && eventData.location;
    const hasPriceData = eventData.ticketPrice !== null && eventData.ticketPrice !== undefined;
    
    // If we're missing price data and haven't reached max retries, try again
    if (hasEssentialData && !hasPriceData && retryCount < maxRetries) {
      const retryDelay = (retryCount + 1) * 2000; // 2s, 4s, 6s, 8s, 10s
      
      // Check if the next retry would exceed our 10-second limit
      if (elapsed + retryDelay > 10000) {
        console.log('Next retry would exceed 10-second limit. Stopping attempts.');
        return;
      }
      
      console.log(`Price data not found, retrying in ${(retryCount + 1) * 2} seconds... (attempt ${retryCount + 1}/${maxRetries})`);
      setTimeout(() => {
        performScraping(retryCount + 1, maxRetries, startTime);
      }, retryDelay);
      return;
    }
    
    // Only cache if we got new data
    if (JSON.stringify(eventData) !== JSON.stringify(lastScrapedData)) {
      cacheEventData(eventData);
      console.log(`Scraping complete after ${retryCount} retries. Price data found: ${hasPriceData}`);
    }
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);
    
    if (message.action === 'scrapeEvent') {
      performScraping();
      sendResponse({ success: true });
    }
    
    if (message.action === 'getEventData') {
      // Return the current scraped data or scrape fresh data
      let eventData = lastScrapedData;
      if (!eventData || !eventData.title) {
        eventData = scrapeEventDetails();
      }
      sendResponse({ eventData: eventData });
    }
  });

  // Auto-scrape when page loads with progressive delays
  async function initialize() {
    
    const bookings = await getStoredBookings();
    console.log(bookings);
    
    // Multiple attempts with increasing delays to catch dynamic content
    const scrapeAttempts = [1000, 3000, 6000]; // 1s, 3s, 6s after page load
    
    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        scrapeAttempts.forEach((delay, index) => {
          setTimeout(() => {
            console.log(`Scheduled scrape attempt ${index + 1} after ${delay}ms`);
            performScraping(0);
          }, delay);
        });
      });
    } else {
      scrapeAttempts.forEach((delay, index) => {
        setTimeout(() => {
          console.log(`Scheduled scrape attempt ${index + 1} after ${delay}ms`);
          performScraping(0);
        }, delay);
      });
    }
  }

  // Watch for dynamic content changes (Eventbrite uses React)
  const observer = new MutationObserver((mutations) => {
    let shouldScrape = false;
    let foundPriceContent = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if new content was added that might contain event details or pricing
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check for general event content
            if (node.querySelector('h1') || node.querySelector('[class*="title"]') || 
                node.querySelector('[class*="date"]') || node.querySelector('[class*="location"]')) {
              shouldScrape = true;
            }
            
            // Specifically check for price-related content
            if (node.querySelector('[class*="price"]') || 
                node.querySelector('[data-testid*="price"]') ||
                node.querySelector('.ticket-card') ||
                node.querySelector('.conversion-bar') ||
                node.textContent.match(/[£$€¥₹]\d+/)) {
              foundPriceContent = true;
              shouldScrape = true;
              console.log('Price-related content detected, triggering scrape');
              break;
            }
          }
        }
      }
    });
    
    if (shouldScrape) {
      // If we found price content, scrape immediately. Otherwise, wait a bit.
      const delay = foundPriceContent ? 100 : 500;
      setTimeout(() => performScraping(0), delay);
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Periodic check for price data that loads very late
  let periodicCheckCount = 0;
  const maxPeriodicChecks = 6; // Check for up to 30 seconds (6 × 5s)
  
  const periodicCheck = setInterval(() => {
    periodicCheckCount++;
    
    // Stop after max attempts or if we already have price data
    if (periodicCheckCount >= maxPeriodicChecks || 
        (lastScrapedData && lastScrapedData.ticketPrice !== null && lastScrapedData.ticketPrice !== undefined)) {
      clearInterval(periodicCheck);
      console.log(`Periodic price checking stopped. Attempts: ${periodicCheckCount}, Has price data: ${lastScrapedData?.ticketPrice !== undefined}`);
      return;
    }
    
    console.log(`Periodic price check ${periodicCheckCount}/${maxPeriodicChecks}`);
    
    // Only scrape if we don't have price data yet
    if (!lastScrapedData || lastScrapedData.ticketPrice === null || lastScrapedData.ticketPrice === undefined) {
      performScraping(0, 2); // Limited retries for periodic checks
    }
  }, 5000); // Every 5 seconds

  // Initialize
  initialize();

})();
// Content script for scraping Eventbrite event details
(function() {
  'use strict';

  console.log('Gumdrop content script loaded on:', window.location.href);

  let lastScrapedData = null;

  // Function to scrape event details from Eventbrite page
  function scrapeEventDetails() {
    console.log('Scraping event details...');
    
    const eventData = {
      title: null,
      date: null,
      location: null,
      url: window.location.href
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
      // console.log("Found location container:", locationContainer);
      
      // Get venue name from the nested p tag
      const venueElement = locationContainer.querySelector('.location-info__address-text');
      let venue = '';
      if (venueElement) {
        venue = venueElement.textContent.trim();
        // console.log("Found venue:", venue);
      }
      
      // Get the full text content and extract address (everything after venue name)
      const fullText = locationContainer.textContent.trim();
      let address = '';
      
      if (venue && fullText.includes(venue)) {
        // Remove the venue name and any extra whitespace to get the address
        address = fullText.replace(venue, '').replace(/Get directions.*$/, '').trim();
        // console.log("Extracted address:", address);
      }
      
      // Combine venue and address
      if (venue && address) {
        eventData.location = `${venue}, ${address}`;
      } else if (venue) {
        eventData.location = venue;
      } else if (address) {
        eventData.location = address;
      }
      
      console.log("Final location:", eventData.location);
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

    // console.log('Scraped event data:', eventData);
    return eventData;
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

  // Main scraping function
  function performScraping() {
    if (!isEventPage()) {
      console.log('Not an event page, skipping scraping');
      return;
    }

    const eventData = scrapeEventDetails();
    
    // Only cache if we got new data
    if (JSON.stringify(eventData) !== JSON.stringify(lastScrapedData)) {
      cacheEventData(eventData);
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

  // Auto-scrape when page loads
  function initialize() {
    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(performScraping, 1000);
      });
    } else {
      setTimeout(performScraping, 1000);
    }
  }

  // Watch for dynamic content changes (Eventbrite uses React)
  const observer = new MutationObserver((mutations) => {
    let shouldScrape = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if new content was added that might contain event details
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.querySelector('h1') || node.querySelector('[class*="title"]') || 
                node.querySelector('[class*="date"]') || node.querySelector('[class*="location"]')) {
              shouldScrape = true;
              break;
            }
          }
        }
      }
    });
    
    if (shouldScrape) {
      setTimeout(performScraping, 500);
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Initialize
  initialize();

})();
let eventDetails = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'EVENT_DETAILS') {
    eventDetails = msg.payload;
  }
  if (msg.type === 'GET_PLAN') {
    handleGetPlan(msg, sendResponse);
    return true; // async response
  }
});

async function handleGetPlan(msg, sendResponse) {
  if (!eventDetails) {
    sendResponse({ error: 'No event detected on page.' });
    return;
  }
  // derive checkin date + nights (simple heuristic)
  const checkin = eventDetails.startDate || '';
  const nights = 1;

  // call local server which proxies to LiteAPI
  try {
    const hotelsResp = await fetch('http://localhost:3000/api/hotels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: eventDetails.location || '', checkin, nights })
    });
    const hotels = await hotelsResp.json();

    // call AI to make recommendation
    const prompt = `Event: ${eventDetails.title}\nDate: ${checkin}\nLocation: ${eventDetails.location}\nHotels: ${JSON.stringify(hotels)}\n\nSuggest the best 3 hotels and a 2-3 sentence rationale and a tiny itinerary.`;
    const aiResp = await fetch('http://localhost:3000/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const aiJson = await aiResp.json();

    sendResponse({ event: eventDetails, hotels, ai: aiJson });
  } catch (err) {
    sendResponse({ error: String(err) });
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  
  // DOM Elements
  const loadingDiv = document.getElementById('loading-bookings');
  const noBookingsDiv = document.getElementById('no-bookings');
  const bookingsContainer = document.getElementById('bookings-container');
  const bookingsGrid = document.getElementById('bookings-grid');
  const refreshBtn = document.getElementById('refresh-bookings');
  const clearDataBtn = document.getElementById('clear-data');
  const bookingModal = document.getElementById('booking-modal');
  const modalContent = document.getElementById('modal-content');
  
  // Helper Functions
  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
  
  function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
  
  function getStatusColor(status) {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  // Safe field access helper
  function safeGet(obj, path, defaultValue = 'N/A') {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : defaultValue;
    }, obj);
  }
  
  // Get bookings from storage
  async function getStoredBookings() {
    try {
      const result = await chrome.storage.local.get(['gumdrop_bookings']);
      return result.gumdrop_bookings || [];
    } catch (error) {
      console.error('Error retrieving bookings:', error);
      return [];
    }
  }
  
  // Update bookings in storage
  async function updateBookingsInStorage(bookings) {
    try {
      await chrome.storage.local.set({ 'gumdrop_bookings': bookings });
    } catch (error) {
      console.error('Error updating bookings:', error);
      throw error;
    }
  }
  
  // Load and display bookings
  async function loadBookings() {
    try {
      loadingDiv.classList.remove('hidden');
      noBookingsDiv.classList.add('hidden');
      bookingsContainer.classList.add('hidden');
      
      const bookings = await getStoredBookings();
      
      if (bookings.length === 0) {
        loadingDiv.classList.add('hidden');
        noBookingsDiv.classList.remove('hidden');
        return;
      }
      
      // Sort bookings by date (newest first)
      bookings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      displayBookings(bookings);
      
      loadingDiv.classList.add('hidden');
      bookingsContainer.classList.remove('hidden');
      
    } catch (error) {
      console.error('Error loading bookings:', error);
      loadingDiv.classList.add('hidden');
      noBookingsDiv.classList.remove('hidden');
    }
  }
  
  // Display bookings in grid
  function displayBookings(bookings) {
    bookingsGrid.innerHTML = '';
    
    bookings.forEach(booking => {
      const bookingCard = createBookingCard(booking);
      bookingsGrid.appendChild(bookingCard);
    });
  }
  
  // Create individual booking card
  function createBookingCard(booking) {
    const card = document.createElement('div');
    card.className = 'bg-white border border-slate-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer transform hover:scale-[1.02]';
    
    const isUpcoming = new Date(booking.dates.checkIn) > new Date();
    const statusColor = getStatusColor(booking.status);
    
    // Get current year
    const currentYear = new Date().getFullYear();

    card.innerHTML = `
      <div class="relative">
        <!-- Status Badge -->
        <div class="absolute top-0 right-0">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColor}">
            ${booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          </span>
        </div>
        
        <!-- Hotel Info -->
        <div class="flex items-start space-x-4 mb-4">
          <img src="${booking.hotel.image || './assets/icon128.png'}" alt="${booking.hotel.name}" class="w-16 h-16 rounded-xl object-cover">
          <div class="flex-1">
            <h3 class="font-bold text-lg text-slate-800 mb-1 leading-tight">${booking.hotel.name}</h3>
            <p class="text-sm text-slate-600 mb-2">${booking.hotel.address}</p>
            <div class="flex items-center space-x-3 text-xs text-slate-500">
              <span>⭐ ${booking.hotel.rating}</span>
              <span>${booking.room.type}</span>
              ${booking.room.rateName ? `<span>${booking.room.rateName}</span>` : ''}
            </div>
          </div>
        </div>
        
        <!-- Dates -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div class="bg-slate-50 rounded-lg p-3">
            <div class="text-xs text-slate-500 font-medium mb-1">CHECK-IN</div>
            <div class="text-sm font-semibold text-slate-800">${formatDate(booking.dates.checkIn).replace(/\d{4}/, currentYear)}</div>
          </div>
          <div class="bg-slate-50 rounded-lg p-3">
            <div class="text-xs text-slate-500 font-medium mb-1">CHECK-OUT</div>
            <div class="text-sm font-semibold text-slate-800">${formatDate(booking.dates.checkOut).replace(/\d{4}/, currentYear)}</div>
          </div>
        </div>
        
        <!-- Event Info -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div class="text-xs text-blue-600 font-medium mb-1">EVENT</div>
          <div class="text-sm font-semibold text-blue-800">${booking.event.title}</div>
          <div class="text-xs text-blue-600">${booking.event.date}</div>
        </div>
        
        <!-- Price -->
        <div class="flex items-center justify-between">
          <div class="text-sm text-slate-600">
            ${booking.dates.nights} night${booking.dates.nights !== 1 ? 's' : ''}
          </div>
          <div class="text-xl font-bold text-slate-800">
            ${booking.pricing.currency} ${booking.prebookData.price}
          </div>
        </div>
        
        <!-- Booking Reference -->
        <div class="mt-3 pt-3 border-t border-slate-200">
          <div class="flex items-center justify-between">
            <span class="text-xs text-slate-500">Ref: ${booking.bookingRef}</span>
            <span class="text-xs text-slate-500">${formatDateTime(booking.timestamp).replace(/\d{4}/, currentYear)}</span>
          </div>
        </div>
      </div>
    `;
    
    // Add click handler to show details
    card.addEventListener('click', () => {
      showBookingDetails(booking);
    });
    
    return card;
  }
  
  // Show booking details in modal
  function showBookingDetails(booking) {
    const statusColor = getStatusColor(booking.status);
    console.log(booking);
    
    modalContent.innerHTML = `
      <div class="p-6">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-slate-800">Booking Details</h2>
          <button id="close-modal" class="text-slate-400 hover:text-slate-600 transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <!-- Status -->
        <div class="mb-6">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusColor}">
            ${booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          </span>
        </div>
        
        <!-- Hotel Details -->
        <div class="bg-slate-50 rounded-xl p-6 mb-6">
          <div class="flex items-start space-x-4">
            <img src="${booking.hotel.image || './assets/icon128.png'}" alt="${booking.hotel.name}" class="w-20 h-20 rounded-xl object-cover">
            <div class="flex-1">
              <h3 class="text-xl font-bold text-slate-800 mb-2">${booking.hotel.name}</h3>
              <p class="text-slate-600 mb-3">${booking.hotel.address}</p>
              <div class="flex items-center space-x-4 text-sm text-slate-500">
                <span>⭐ ${booking.hotel.rating}</span>
                <span>${booking.room.type}</span>
                ${booking.room.rateName ? `<span>${booking.room.rateName}</span>` : ''}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Stay Details -->
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div class="bg-white border border-slate-200 rounded-xl p-4">
            <div class="text-sm text-slate-500 font-medium mb-1">CHECK-IN</div>
            <div class="text-lg font-bold text-slate-800">${formatDate(booking.dates.checkIn)}</div>
          </div>
          <div class="bg-white border border-slate-200 rounded-xl p-4">
            <div class="text-sm text-slate-500 font-medium mb-1">CHECK-OUT</div>
            <div class="text-lg font-bold text-slate-800">${formatDate(booking.dates.checkOut)}</div>
          </div>
        </div>
        
        <!-- Event Details -->
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h4 class="font-bold text-blue-800 mb-3">Event Information</h4>
          <div class="space-y-2">
            <div>
              <span class="text-sm text-blue-600 font-medium">Event:</span>
              <span class="text-sm text-blue-800 ml-2">${booking.event.title}</span>
            </div>
            <div>
              <span class="text-sm text-blue-600 font-medium">Date:</span>
              <span class="text-sm text-blue-800 ml-2">${booking.event.date}</span>
            </div>
            <div>
              <span class="text-sm text-blue-600 font-medium">Location:</span>
              <span class="text-sm text-blue-800 ml-2">${booking.event.location}</span>
            </div>
          </div>
        </div>
        
        <!-- Guest Information -->
        <div class="bg-white border border-slate-200 rounded-xl p-4 mb-6">
          <h4 class="font-bold text-slate-800 mb-3">Guest Information</h4>
          <div class="space-y-3">
            <div>
              <span class="text-sm text-slate-600 font-medium">Primary Contact:</span>
              <span class="text-sm text-slate-800 ml-2">${booking.holder.firstName} ${booking.holder.lastName}</span>
            </div>
            <div>
              <span class="text-sm text-slate-600 font-medium">Email:</span>
              <span class="text-sm text-slate-800 ml-2">${booking.holder.email}</span>
            </div>
            <div>
              <span class="text-sm text-slate-600 font-medium">Phone:</span>
              <span class="text-sm text-slate-800 ml-2">${booking.holder.phone}</span>
            </div>
            ${booking.guests.length > 1 ? `
              <div class="mt-4 pt-3 border-t border-slate-200">
                <span class="text-sm text-slate-600 font-medium">Additional Guests:</span>
                <div class="mt-2 space-y-1">
                  ${booking.guests.slice(1).map(guest => `
                    <div class="text-sm text-slate-700">${guest.firstName} ${guest.lastName}</div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
        
        <!-- Pricing -->
        <div class="bg-white border border-slate-200 rounded-xl p-4 mb-6">
          <h4 class="font-bold text-slate-800 mb-3">Pricing Details</h4>
          <div class="space-y-2 mb-4">
            <div class="flex justify-between items-center">
              <span class="text-sm text-slate-600">Nights:</span>
              <span class="text-sm text-slate-800">${booking.dates.nights}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-slate-600">Occupancy:</span>
              <span class="text-sm text-slate-800">${booking.room.occupancy}</span>
            </div>
            ${booking.pricing.breakdown && booking.prebookData.price ? `
              <div class="flex justify-between items-center">
                <span class="text-sm text-slate-600">Room Rate:</span>
                <span class="text-sm text-slate-800">${booking.pricing.currency} ${booking.prebookData.price}</span>
              </div>
            ` : ''}
            ${booking.pricing.breakdown && booking.pricing.breakdown.taxes ? `
              <div class="flex justify-between items-center">
                <span class="text-sm text-slate-600">Taxes & Fees:</span>
                <span class="text-sm text-slate-800">${booking.pricing.currency} ${booking.pricing.breakdown.taxes}</span>
              </div>
            ` : ''}
            ${booking.pricing.breakdown && booking.pricing.breakdown.fees ? `
              <div class="flex justify-between items-center">
                <span class="text-sm text-slate-600">Additional Fees:</span>
                <span class="text-sm text-slate-800">${booking.pricing.currency} ${booking.pricing.breakdown.fees}</span>
              </div>
            ` : ''}
          </div>
          <div class="pt-3 border-t border-slate-200">
            <div class="flex justify-between items-center">
              <span class="text-lg font-semibold text-slate-800">Total:</span>
              <span class="text-2xl font-bold text-slate-800">${booking.pricing.currency} ${booking.prebookData.price}</span>
            </div>
          </div>
        </div>
        
        <!-- Booking Reference -->
        <div class="bg-slate-50 rounded-xl p-4 mb-6">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-slate-600 font-medium">Booking Reference:</span>
              <div class="text-slate-800 font-mono">${booking.bookingRef}</div>
            </div>
            <div>
              <span class="text-slate-600 font-medium">Booked On:</span>
              <div class="text-slate-800">${formatDateTime(booking.timestamp)}</div>
            </div>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="flex space-x-3">
          ${booking.status === 'confirmed' ? `
            <button id="cancel-booking-modal" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-xl transition-colors duration-200">
              Cancel Booking
            </button>
          ` : ''}
          <button id="delete-booking-modal" class="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-medium py-3 px-4 rounded-xl transition-colors duration-200">
            Delete Record
          </button>
        </div>
      </div>
    `;
    
    bookingModal.classList.remove('hidden');
    
    // Add event listeners
    document.getElementById('close-modal')?.addEventListener('click', closeModal);
    
    document.getElementById('cancel-booking-modal')?.addEventListener('click', () => {
      cancelBooking(booking);
    });
    
    document.getElementById('delete-booking-modal')?.addEventListener('click', () => {
      deleteBookingRecord(booking);
    });
  }
  
  function closeModal() {
    bookingModal.classList.add('hidden');
  }
  
  async function cancelBooking(booking) {
    if (confirm(`Are you sure you want to cancel your booking at ${booking.hotel.name}?`)) {
      try {
        const bookings = await getStoredBookings();
        const updatedBookings = bookings.map(b => 
          b.id === booking.id ? { ...b, status: 'cancelled' } : b
        );
        
        await updateBookingsInStorage(updatedBookings);
        closeModal();
        await loadBookings();
        
        // Show success message
        showNotification('Booking cancelled successfully', 'success');
        
      } catch (error) {
        console.error('Error cancelling booking:', error);
        showNotification('Failed to cancel booking', 'error');
      }
    }
  }
  
  async function deleteBookingRecord(booking) {
    if (confirm(`Are you sure you want to delete this booking record? This action cannot be undone.`)) {
      try {
        const bookings = await getStoredBookings();
        const updatedBookings = bookings.filter(b => b.id !== booking.id);
        
        await updateBookingsInStorage(updatedBookings);
        closeModal();
        await loadBookings();
        
        showNotification('Booking record deleted', 'success');
        
      } catch (error) {
        console.error('Error deleting booking:', error);
        showNotification('Failed to delete booking record', 'error');
      }
    }
  }
  
  // Simple notification function
  function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-[60] p-4 rounded-lg shadow-lg transition-all duration-300 ${
      type === 'success' 
        ? 'bg-green-100 text-green-800 border border-green-200' 
        : 'bg-red-100 text-red-800 border border-red-200'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
  
  // Clear all booking data function
  async function clearAllData() {
    if (confirm('⚠️ Are you sure you want to clear all booking data?\n\nThis action cannot be undone and will delete all your stored bookings.')) {
      try {
        // Clear Chrome storage
        await chrome.storage.local.remove(['gumdrop_bookings']);
        
        // Show success notification
        showNotification('All booking data cleared successfully!', 'success');
        
        // Reload the view
        await loadBookings();
        
      } catch (error) {
        console.error('Error clearing data:', error);
        showNotification('Failed to clear data. Please try again.', 'error');
      }
    }
  }

  // Event Listeners
  refreshBtn?.addEventListener('click', loadBookings);
  clearDataBtn?.addEventListener('click', clearAllData);
  
  // Close modal on background click
  bookingModal?.addEventListener('click', (e) => {
    if (e.target === bookingModal) {
      closeModal();
    }
  });
  
  // Initialize
  await loadBookings();
  
});
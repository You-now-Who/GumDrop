document.addEventListener('DOMContentLoaded', function() {
    console.log('Booking completion page loaded');
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const transactionId = urlParams.get('transactionId');
    const prebookId = urlParams.get('prebookId');
    
    if (action === 'complete-booking' && transactionId && prebookId) {
        completeBooking(transactionId, prebookId);
    } else {
        showError('Invalid booking completion request. Missing required parameters.');
    }
    
    async function completeBooking(transactionId, prebookId) {
        try {
            console.log('Completing booking with:', { transactionId, prebookId });
            
            // Get the booking data and guest information from storage
            const bookingData = await getBookingDataFromStorage();
            
            if (!bookingData) {
                throw new Error('Booking data not found');
            }
            
            // Prepare the final booking payload
            const bookingPayload = {
                holder: bookingData.holder,
                payment: {
                    method: 'TRANSACTION_ID',
                    transactionId: transactionId
                },
                guests: bookingData.guests,
                prebookId: prebookId
            };
            
            console.log('Final booking payload:', bookingPayload);
            
            // Call the booking API
            const response = await fetch('http://localhost:3000/api/book', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookingPayload)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Booking failed with status ${response.status}`);
            }
            
            const bookingResult = await response.json();
            console.log('Booking completed successfully:', bookingResult);
            
            // Show success state
            showSuccess(bookingResult, bookingData);
            
            // Clean up stored data
            await clearBookingData();
            
        } catch (error) {
            console.error('Booking completion error:', error);
            showError(`Failed to complete booking: ${error.message}`);
        }
    }
    
    async function getBookingDataFromStorage() {
        try {
            // Try chrome storage first
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(['pendingBookingData']);
                return result.pendingBookingData || null;
            }
            
            // Fallback to localStorage
            const stored = localStorage.getItem('pendingBookingData');
            return stored ? JSON.parse(stored) : null;
            
        } catch (error) {
            console.error('Error retrieving booking data:', error);
            return null;
        }
    }
    
    async function clearBookingData() {
        try {
            // Clear chrome storage
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.remove(['pendingBookingData']);
            }
            
            // Clear localStorage
            localStorage.removeItem('pendingBookingData');
            
        } catch (error) {
            console.error('Error clearing booking data:', error);
        }
    }
    
    function showSuccess(bookingResult, bookingData) {
        // Hide loading, show success
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('success-state').classList.remove('hidden');
        
        // Populate booking details
        document.getElementById('confirm-hotel-name').textContent = bookingData.hotelName || 'Hotel Booking';
        document.getElementById('confirm-room-type').textContent = bookingData.roomName || 'Standard Room';
        document.getElementById('confirm-dates').textContent = bookingData.dates || 'Event dates';
        
        // Booking ID from API response
        const bookingId = bookingResult.bookingId || 
                         bookingResult.bookingMeta?.gumDropBookingId || 
                         bookingResult.data?.bookingId || 
                         'N/A';
        document.getElementById('confirm-booking-id').textContent = bookingId;
        
        // Total price
        const currency = bookingData.currency || 'USD';
        const symbol = currency === 'USD' ? '$' : '£';
        const totalPrice = bookingData.totalPrice || 0;
        document.getElementById('confirm-total-price').textContent = `Total: ${symbol}${totalPrice.toFixed(2)}`;
        
        // Guest information
        const guestsContainer = document.getElementById('confirm-guests');
        guestsContainer.innerHTML = '';
        
        if (bookingData.guests && bookingData.guests.length > 0) {
            bookingData.guests.forEach((guest, index) => {
                const guestDiv = document.createElement('div');
                guestDiv.className = 'text-sm text-slate-600';
                guestDiv.innerHTML = `
                    <strong>Guest ${index + 1}:</strong> ${guest.firstName} ${guest.lastName}
                    <span class="ml-4 text-slate-500">${guest.email}</span>
                `;
                guestsContainer.appendChild(guestDiv);
            });
        }
    }
    
    function showError(message) {
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('error-state').classList.remove('hidden');
        document.getElementById('error-message').textContent = message;
    }
    
    // Event Listeners
    document.getElementById('email-confirmation').addEventListener('click', async () => {
        // This could trigger an email confirmation API call
        const button = document.getElementById('email-confirmation');
        const originalText = button.innerHTML;
        
        button.innerHTML = `
            <svg class="w-5 h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Sending...
        `;
        
        // Simulate email sending (replace with actual API call)
        setTimeout(() => {
            button.innerHTML = `
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                Email Sent!
            `;
            button.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            button.classList.add('bg-green-600', 'hover:bg-green-700');
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('bg-green-600', 'hover:bg-green-700');
                button.classList.add('bg-blue-600', 'hover:bg-blue-700');
            }, 3000);
        }, 2000);
    });
    
    document.getElementById('close-window').addEventListener('click', () => {
        window.close();
    });
    
    document.getElementById('retry-booking').addEventListener('click', () => {
        // Go back to payment or close window
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.close();
        }
    });
    
    document.getElementById('contact-support').addEventListener('click', () => {
        // Open support contact (could be email, chat, etc.)
        window.open('mailto:support@gumdrop.travel?subject=Booking%20Issue&body=I%20need%20help%20with%20my%20booking.');
    });
});
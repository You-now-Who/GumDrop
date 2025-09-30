document.addEventListener('DOMContentLoaded', function() {
  console.log('Setup page loaded');
  
  const setupForm = document.getElementById('setup-form');
  const submitBtn = document.getElementById('setup-submit');
  const skipBtn = document.getElementById('skip-setup');

  // Generate a unique client ID
  function generateClientId() {
    return 'gmd_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  // Save user data to Chrome storage
  async function saveUserData(userData) {
    try {
      await chrome.storage.local.set({
        userProfile: userData,
        setupCompleted: true,
        setupDate: new Date().toISOString()
      });
      console.log('User data saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving user data:', error);
      return false;
    }
  }

  // Handle form submission
  setupForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Show loading state
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<svg class="w-5 h-5 animate-spin inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Setting up...';
    submitBtn.disabled = true;

    // Get form data
    const formData = new FormData(setupForm);
    const userData = {
      clientId: generateClientId(),
      firstName: formData.get('firstName').trim(),
      lastName: formData.get('lastName').trim(),
      email: formData.get('email').trim(),
      phone: formData.get('phone').trim(),
      createdAt: new Date().toISOString()
    };

    // Validate data
    if (!userData.firstName || !userData.lastName || !userData.email || !userData.phone) {
      alert('Please fill in all fields');
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      return;
    }

    // Save data
    const success = await saveUserData(userData);
    
    if (success) {
      // Show success state
      submitBtn.innerHTML = '<svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Setup Complete!';
      submitBtn.className = 'w-full bg-green-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg';
      
      // Close setup tab after delay
      setTimeout(() => {
        // Show a message before closing
        submitBtn.innerHTML = '<svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Click the Gumdrop icon to start!';
        
        setTimeout(() => {
          window.close();
        }, 2000);
      }, 1500);
    } else {
      // Show error state
      submitBtn.innerHTML = '<svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Setup Failed';
      submitBtn.className = 'w-full bg-red-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg';
      
      // Reset after 3 seconds
      setTimeout(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        submitBtn.className = 'w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200';
      }, 3000);
    }
  });

  // Handle skip setup
  skipBtn.addEventListener('click', async function() {
    // Mark as skipped but not completed
    try {
      await chrome.storage.local.set({
        setupSkipped: true,
        skipDate: new Date().toISOString()
      });
      
      // Close setup window
      window.close();
    } catch (error) {
      console.error('Error skipping setup:', error);
      window.close();
    }
  });

  // Add input validation and formatting
  const phoneInput = document.getElementById('phone');
  phoneInput.addEventListener('input', function(e) {
    // Basic phone number formatting (US format)
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 10) {
      value = value.substring(0, 10);
      value = `+1 (${value.substring(0, 3)}) ${value.substring(3, 6)}-${value.substring(6)}`;
    } else if (value.length >= 6) {
      value = `(${value.substring(0, 3)}) ${value.substring(3, 6)}-${value.substring(6)}`;
    } else if (value.length >= 3) {
      value = `(${value.substring(0, 3)}) ${value.substring(3)}`;
    }
    e.target.value = value;
  });

  // Add form validation styling
  const inputs = document.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('blur', function() {
      if (this.value.trim() === '') {
        this.classList.add('border-red-300', 'ring-red-500');
        this.classList.remove('border-slate-200');
      } else {
        this.classList.remove('border-red-300', 'ring-red-500');
        this.classList.add('border-green-300');
      }
    });

    input.addEventListener('focus', function() {
      this.classList.remove('border-red-300', 'border-green-300');
      this.classList.add('border-slate-200');
    });
  });
});
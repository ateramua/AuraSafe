// AuraSafe Pairing Page Script (Firefox Compatible)
// Version: 1.0.0

// ===================== CROSS-BROWSER COMPATIBILITY =====================
const browserAPI = (function() {
  if (typeof browser !== 'undefined' && browser.runtime) {
    return browser;
  }
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome;
  }
  return null;
})();

const runtime = browserAPI ? browserAPI.runtime : null;
const storage = browserAPI ? browserAPI.storage : null;

// DOM Elements
const pairingCodeInput = document.getElementById('pairingCode');
const pairBtn = document.getElementById('pairBtn');
const cancelBtn = document.getElementById('cancelBtn');
const statusDiv = document.getElementById('status');

// Helper: Show status message
function showStatus(message, type = 'info') {
  if (!statusDiv) return;
  
  statusDiv.className = `status ${type}`;
  statusDiv.textContent = message;
  
  // Auto-hide success/error after 5 seconds
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      if (statusDiv.className === `status ${type}`) {
        statusDiv.style.display = 'none';
        statusDiv.className = 'status';
      }
    }, 5000);
  }
}

// Helper: Send message to background script
async function sendMessage(message) {
  if (!runtime) {
    showStatus('Extension API not available', 'error');
    return null;
  }
  
  return new Promise((resolve) => {
    try {
      const result = runtime.sendMessage(message);
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(() => resolve(null));
      } else {
        runtime.sendMessage(message, (response) => {
          if (runtime.lastError) {
            resolve(null);
          } else {
            resolve(response);
          }
        });
      }
    } catch (error) {
      console.error('Message failed:', error);
      resolve(null);
    }
  });
}

// Validate pairing code format
function isValidPairingCode(code) {
  // 32-character alphanumeric code (uppercase)
  const regex = /^[A-Z0-9]{32}$/;
  return code && regex.test(code);
}

// Pair with desktop
async function pairWithDesktop() {
  const code = pairingCodeInput.value.trim().toUpperCase();
  
  if (!code) {
    showStatus('Please enter a pairing code', 'error');
    pairingCodeInput.focus();
    return;
  }
  
  if (!isValidPairingCode(code)) {
    showStatus('Invalid pairing code. Code should be 32 characters (letters A-Z, numbers 0-9)', 'error');
    pairingCodeInput.focus();
    return;
  }
  
  // Disable button and show loading
  pairBtn.disabled = true;
  pairBtn.innerHTML = '<span class="spinner"></span> Pairing...';
  showStatus('Pairing with desktop app...', 'info');
  
  try {
    // Send pairing request to background
    const response = await sendMessage({
      type: 'PAIR_WITH_DESKTOP',
      payload: { pairingCode: code }
    });
    
    if (response && response.success) {
      showStatus('✅ Successfully paired with desktop app! Closing in 2 seconds...', 'success');
      
      // Save paired status
      if (storage) {
        await storage.local.set({ aurasafe_paired: true });
      }
      
      // Close window after delay
      setTimeout(() => {
        window.close();
      }, 2000);
    } else {
      const errorMsg = response?.error || 'Pairing failed. Please check the code and try again.';
      showStatus(`❌ ${errorMsg}`, 'error');
      pairBtn.disabled = false;
      pairBtn.innerHTML = '🔗 Pair Extension';
      pairingCodeInput.focus();
    }
  } catch (error) {
    console.error('Pairing error:', error);
    showStatus('❌ Pairing failed. Make sure the desktop app is running.', 'error');
    pairBtn.disabled = false;
    pairBtn.innerHTML = '🔗 Pair Extension';
  }
}

// Cancel and close
function cancelPairing() {
  window.close();
}

// Auto-submit when Enter key is pressed
pairingCodeInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    pairWithDesktop();
  }
});

// Event listeners
pairBtn.addEventListener('click', pairWithDesktop);
cancelBtn.addEventListener('click', cancelPairing);

// Auto-focus input field
pairingCodeInput.focus();

// Convert to uppercase as user types
pairingCodeInput.addEventListener('input', (event) => {
  event.target.value = event.target.value.toUpperCase();
});

// Check if already paired on load
async function checkExistingPairing() {
  if (storage) {
    const result = await storage.local.get(['aurasafe_paired']);
    if (result.aurasafe_paired) {
      showStatus('Already paired with desktop app', 'info');
    }
  }
}

checkExistingPairing();
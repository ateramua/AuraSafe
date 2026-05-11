// ========================
// AuraSafe Content Script (Modernized)
// Handles auto-fill on web pages with visual feedback
// ========================

(function() {
  'use strict';
  
  // Visual feedback indicator
  let notificationTimeout = null;
  
  /**
   * Show temporary notification on the page
   */
  function showNotification(message, type = 'success') {
    // Remove existing notification if present
    const existingNotif = document.getElementById('aurasafe-notification');
    if (existingNotif) {
      existingNotif.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'aurasafe-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000000;
        background: ${type === 'success' ? '#1e4b6e' : '#dc2626'};
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 8px 20px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 10px;
        backdrop-filter: blur(8px);
        animation: slideIn 0.3s ease;
        pointer-events: none;
      ">
        <span>${type === 'success' ? '🔐' : '⚠️'}</span>
        <span>${message}</span>
      </div>
      <style>
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      </style>
    `;
    
    document.body.appendChild(notification);
    
    if (notificationTimeout) clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => {
      if (notification) notification.remove();
    }, 2500);
  }
  
  /**
   * Enhanced field detection with multiple selectors
   */
  function findUsernameField(root = document) {
    const selectors = [
      'input[autocomplete="username"]',
      'input[type="email"]',
      'input[type="text"]',
      'input[name*="user" i]',
      'input[name*="email" i]',
      'input[name*="login" i]',
      'input[id*="user" i]',
      'input[id*="email" i]',
      'input[placeholder*="username" i]',
      'input[placeholder*="email" i]',
      'input[placeholder*="user" i]'
    ];

    for (const selector of selectors) {
      const field = root.querySelector(selector);
      if (field && field.offsetParent !== null) {
        return field;
      }
    }
    return null;
  }

  function findPasswordField() {
    const selectors = [
      'input[type="password"]',
      'input[name*="password" i]',
      'input[id*="password" i]',
      'input[autocomplete="current-password"]',
      'input[placeholder*="password" i]'
    ];

    const candidates = Array.from(document.querySelectorAll(selectors.join(',')));
    return candidates.find(field => field && field.offsetParent !== null) || null;
  }
  
  /**
   * Dispatch proper events to trigger framework reactivity
   */
  function triggerReactiveness(element) {
    if (!element) return;
    
    // Native events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    
    // React-specific (simulate property change)
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(element, element.value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Vue.js reactivity
    if (element.__vue__) {
      element.__vue__.$forceUpdate();
    }
    
    // Manual trigger for some frameworks
    const event = new CustomEvent('aurasafe-filled', { bubbles: true, detail: { value: element.value } });
    element.dispatchEvent(event);
  }
  
  /**
   * Main fill function - preserves original behavior with enhancements
   */
  function fillCredentials(entry) {
    const passwordField = findPasswordField();
    let usernameField = null;

    if (passwordField) {
      const form = passwordField.closest('form') || document;
      usernameField = findUsernameField(form);
    }

    if (!usernameField) {
      usernameField = findUsernameField();
    }

    if (!usernameField && !passwordField) {
      showNotification('No login fields found on this page', 'error');
      return { success: false, reason: 'fields_not_found' };
    }
    
    let filledCount = 0;
    
    // Fill username if field exists and entry has username
    if (usernameField && entry.username) {
      usernameField.value = entry.username;
      triggerReactiveness(usernameField);
      filledCount++;
      
      // Visual highlight effect
      usernameField.style.transition = 'box-shadow 0.2s';
      usernameField.style.boxShadow = '0 0 0 3px rgba(30, 75, 110, 0.3)';
      setTimeout(() => {
        usernameField.style.boxShadow = '';
      }, 800);
    }
    
    // Fill password if field exists and entry has password
    if (passwordField && entry.password) {
      passwordField.value = entry.password;
      triggerReactiveness(passwordField);
      filledCount++;
      
      passwordField.style.transition = 'box-shadow 0.2s';
      passwordField.style.boxShadow = '0 0 0 3px rgba(30, 75, 110, 0.3)';
      setTimeout(() => {
        passwordField.style.boxShadow = '';
      }, 800);
    }
    
    if (filledCount > 0) {
      const siteName = entry.name || entry.site || 'credentials';
      showNotification(`✓ Filled ${siteName}`, 'success');
      
      // Optional: attempt to submit form after fill (configurable)
      // Uncomment if you want auto-submit behavior
      // setTimeout(() => {
      //   const form = usernameField?.closest('form') || passwordField?.closest('form');
      //   if (form && form.querySelector('button[type="submit"]')) {
      //     form.querySelector('button[type="submit"]').click();
      //   }
      // }, 500);
    }
    
    return { success: true, filledCount };
  }
  
  // Listen for fill messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'fill') {
      const { entry } = request;
      
      if (!entry) {
        sendResponse({ success: false, error: 'No entry provided' });
        return true;
      }
      
      const result = fillCredentials(entry);
      sendResponse(result);
    }
    
    // Optional: ping to check if content script is ready
    if (request.type === 'ping') {
      sendResponse({ status: 'ready', url: window.location.href });
    }
    
    return true; // Keep channel open
  });
  
  // Log that content script is active
  console.log('[AuraSafe] Content script active and ready for auto-fill');

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'AuraSafePage') {
      return;
    }

    const requestId = event.data.requestId || null;
    const payload = event.data.payload;

    chrome.runtime.sendMessage({ type: 'bridge:proxy', payload }, (response) => {
      window.postMessage({ source: 'AuraSafeExtension', requestId, response }, '*');
    });
  });
  
  // Optional: Add keyboard shortcut listener (Ctrl+Shift+A to fill last used)
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      // Request last used entry from background
      chrome.runtime.sendMessage({ action: 'getLastEntry' }, (response) => {
        if (response && response.entry) {
          fillCredentials(response.entry);
        }
      });
    }
  });
})();
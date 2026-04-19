// ===================== CONTENT SCRIPT =====================
// AuraSafe Password Manager - Auto-fill & Form Detection
// Version: 1.0.0

// ===================== CONFIGURATION =====================
const CONFIG = {
  // Field selectors (ordered by priority)
  USERNAME_SELECTORS: [
    'input[type="email"]',
    'input[type="text"][name*="user" i]',
    'input[type="text"][name*="email" i]',
    'input[type="text"][name*="login" i]',
    'input[type="text"][name*="username" i]',
    'input[type="text"][id*="user" i]',
    'input[type="text"][id*="email" i]',
    'input[type="text"][id*="login" i]',
    'input[type="text"][id*="username" i]',
    'input[name="username"]',
    'input[name="user"]',
    'input[name="email"]',
    'input[name="login"]',
    'input[id="username"]',
    'input[id="user"]',
    'input[id="email"]',
    'input[id="login"]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[placeholder*="username" i]',
    'input[placeholder*="email" i]',
    'input[placeholder*="user name" i]'
  ],
  
  PASSWORD_SELECTORS: [
    'input[type="password"]',
    'input[type="password"][name*="password" i]',
    'input[type="password"][id*="password" i]',
    'input[name="password"]',
    'input[id="password"]',
    'input[autocomplete="current-password"]',
    'input[autocomplete="new-password"]',
    'input[placeholder*="password" i]'
  ],
  
  SUBMIT_SELECTORS: [
    'input[type="submit"]',
    'button[type="submit"]',
    'button:contains("Sign in")',
    'button:contains("Login")',
    'button:contains("Log in")',
    'button:contains("Sign in")',
    'form button',
    'form input[type="submit"]'
  ],
  
  // Form detection
  FORM_SELECTORS: [
    'form[action*="login" i]',
    'form[action*="signin" i]',
    'form[action*="auth" i]',
    'form:has(input[type="password"])'
  ],
  
  // Debounce delay (ms)
  DEBOUNCE_DELAY: 300,
  
  // Mutation observer config
  OBSERVER_CONFIG: {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'type']
  }
};

// ===================== STATE MANAGEMENT =====================
let currentForm = null;
let detectedFields = {
  username: null,
  password: null,
  submit: null
};
let fillTimeout = null;
let pageUrl = window.location.href;
let domain = window.location.hostname;

// ===================== UTILITY FUNCTIONS =====================

/**
 * Debounce function to limit rapid executions
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Find element by multiple selectors
 */
function findElement(selectors, container = document) {
  for (const selector of selectors) {
    try {
      const element = container.querySelector(selector);
      if (element && element.offsetParent !== null) {
        return element;
      }
    } catch (e) {
      // Invalid selector, continue
    }
  }
  return null;
}

/**
 * Find all matching elements
 */
function findAllElements(selectors, container = document) {
  for (const selector of selectors) {
    try {
      const elements = container.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements).filter(el => el.offsetParent !== null);
      }
    } catch (e) {
      // Invalid selector, continue
    }
  }
  return [];
}

/**
 * Detect form fields on the page
 */
function detectFormFields() {
  const result = {
    username: null,
    password: null,
    submit: null,
    form: null
  };
  
  // Find password field first (most reliable)
  result.password = findElement(CONFIG.PASSWORD_SELECTORS);
  
  // Find username field
  if (result.password) {
    // Look for username near the password field
    const form = result.password.closest('form');
    if (form) {
      result.form = form;
      // Search for username within the same form
      result.username = findElement(CONFIG.USERNAME_SELECTORS, form);
      
      // Find submit button within form
      result.submit = findElement(CONFIG.SUBMIT_SELECTORS, form);
    }
  }
  
  // Fallback: search entire document
  if (!result.username) {
    result.username = findElement(CONFIG.USERNAME_SELECTORS);
  }
  
  if (!result.form && result.username) {
    result.form = result.username.closest('form');
  }
  
  if (!result.submit && result.form) {
    result.submit = findElement(CONFIG.SUBMIT_SELECTORS, result.form);
  }
  
  return result;
}

/**
 * Update detected fields and notify extension
 */
function updateDetectedFields() {
  const fields = detectFormFields();
  detectedFields = fields;
  
  // Notify extension about detected fields
  chrome.runtime.sendMessage({
    type: 'FIELDS_DETECTED',
    payload: {
      hasUsername: !!fields.username,
      hasPassword: !!fields.password,
      hasForm: !!fields.form,
      url: pageUrl,
      domain: domain
    }
  }).catch(() => {
    // Extension not ready, ignore
  });
  
  return fields;
}

/**
 * Fill credentials into form fields
 */
async function fillCredentials(entry) {
  if (!entry) {
    console.warn('[AuraSafe] No entry provided for fill');
    return false;
  }
  
  // Re-detect fields in case DOM changed
  const fields = detectFormFields();
  
  if (!fields.username && !fields.password) {
    console.warn('[AuraSafe] Could not find fillable fields');
    showNotification('Could not find username/password fields on this page', 'error');
    return false;
  }
  
  try {
    // Fill username
    if (fields.username && entry.username) {
      setFieldValue(fields.username, entry.username);
      highlightField(fields.username, 'success');
    }
    
    // Fill password
    if (fields.password && entry.password) {
      setFieldValue(fields.password, entry.password);
      highlightField(fields.password, 'success');
    }
    
    // Show success indicator
    showFillIndicator(true);
    
    // Auto-submit if configured
    const settings = await getSettings();
    if (settings.autoSubmit && fields.submit) {
      setTimeout(() => {
        fields.submit.click();
      }, 500);
    }
    
    return true;
    
  } catch (error) {
    console.error('[AuraSafe] Fill error:', error);
    showNotification('Failed to fill credentials', 'error');
    return false;
  }
}

/**
 * Set field value and trigger events
 */
function setFieldValue(field, value) {
  const originalValue = field.value;
  field.value = value;
  
  // Trigger events to ensure website detects change
  field.dispatchEvent(new Event('focus', { bubbles: true }));
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  field.dispatchEvent(new Event('blur', { bubbles: true }));
  
  // For React/Vue apps, also trigger property change
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  
  if (nativeInputValueSetter && originalValue !== value) {
    nativeInputValueSetter.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/**
 * Highlight field temporarily
 */
function highlightField(field, type = 'success') {
  const originalOutline = field.style.outline;
  const originalBackground = field.style.backgroundColor;
  const originalTransition = field.style.transition;
  
  const colors = {
    success: 'rgba(16, 185, 129, 0.3)',
    error: 'rgba(239, 68, 68, 0.3)',
    warning: 'rgba(245, 158, 11, 0.3)'
  };
  
  field.style.transition = 'all 0.2s ease';
  field.style.outline = `2px solid ${type === 'success' ? '#10B981' : '#EF4444'}`;
  field.style.backgroundColor = colors[type] || colors.success;
  
  setTimeout(() => {
    field.style.outline = originalOutline;
    field.style.backgroundColor = originalBackground;
    field.style.transition = originalTransition;
  }, 1000);
}

/**
 * Show fill indicator
 */
function showFillIndicator(success) {
  const indicator = document.createElement('div');
  indicator.textContent = success ? '✓ Filled by AuraSafe' : '✗ Fill failed';
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${success ? '#10B981' : '#EF4444'};
    color: white;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(indicator);
  
  setTimeout(() => {
    indicator.style.opacity = '0';
    indicator.style.transition = 'opacity 0.3s ease';
    setTimeout(() => indicator.remove(), 300);
  }, 2000);
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
  chrome.runtime.sendMessage({
    type: 'SHOW_NOTIFICATION',
    payload: { message, type }
  }).catch(() => {});
}

/**
 * Get extension settings
 */
async function getSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
      resolve(response || { autoSubmit: false, autoDetect: true });
    }).catch(() => resolve({ autoSubmit: false, autoDetect: true }));
  });
}

/**
 * Save new credentials for current site
 */
async function saveCredentials(username, password) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: 'SAVE_CREDENTIALS',
      payload: {
        url: pageUrl,
        domain: domain,
        title: document.title,
        username: username,
        password: password
      }
    }, (response) => {
      resolve(response);
    });
  });
}

// ===================== FORM MONITORING =====================

/**
 * Watch for new forms added to the page
 */
function watchForForms() {
  const observer = new MutationObserver(debounce(() => {
    const newFields = detectFormFields();
    if (newFields.password !== detectedFields.password ||
        newFields.username !== detectedFields.username) {
      updateDetectedFields();
    }
  }, CONFIG.DEBOUNCE_DELAY));
  
  observer.observe(document.body, CONFIG.OBSERVER_CONFIG);
}

/**
 * Monitor form submission to capture new credentials
 */
function monitorFormSubmission() {
  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!form) return;
    
    // Check if this is a login form
    const passwordField = form.querySelector('input[type="password"]');
    if (!passwordField) return;
    
    const usernameField = form.querySelector('input[type="text"], input[type="email"]');
    const username = usernameField?.value || '';
    const password = passwordField.value;
    
    if (password) {
      // Notify extension about form submission
      chrome.runtime.sendMessage({
        type: 'FORM_SUBMITTED',
        payload: {
          url: pageUrl,
          domain: domain,
          title: document.title,
          username: username,
          password: password
        }
      }).catch(() => {});
    }
  });
}

// ===================== MESSAGE HANDLING =====================

/**
 * Handle messages from extension
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleAsync = async () => {
    try {
      switch (request.type) {
        case 'FILL':
          const success = await fillCredentials(request.payload);
          sendResponse({ success });
          break;
          
        case 'DETECT_FIELDS':
          const fields = updateDetectedFields();
          sendResponse({
            success: true,
            fields: {
              hasUsername: !!fields.username,
              hasPassword: !!fields.password,
              hasForm: !!fields.form
            }
          });
          break;
          
        case 'GET_PAGE_INFO':
          sendResponse({
            url: pageUrl,
            domain: domain,
            title: document.title
          });
          break;
          
        case 'HIGHLIGHT_FIELDS':
          if (detectedFields.username) highlightField(detectedFields.username, 'warning');
          if (detectedFields.password) highlightField(detectedFields.password, 'warning');
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('[AuraSafe] Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  };
  
  handleAsync();
  return true; // Keep channel open for async response
});

// ===================== INITIALIZATION =====================

/**
 * Initialize content script
 */
function init() {
  // Detect initial fields
  updateDetectedFields();
  
  // Start watching for new forms
  watchForForms();
  
  // Monitor form submissions
  monitorFormSubmission();
  
  // Notify extension that content script is ready
  chrome.runtime.sendMessage({
    type: 'CONTENT_SCRIPT_READY',
    payload: {
      url: pageUrl,
      domain: domain
    }
  }).catch(() => {});
  
  console.log('[AuraSafe] Content script initialized for', domain);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
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
`;
document.head.appendChild(style);

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
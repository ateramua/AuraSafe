// ===================== CONTENT SCRIPT - FIREFOX =====================
// AuraSafe Password Manager - Auto-fill & Form Detection
// Version: 1.1.0

// ===================== CONFIGURATION =====================
const CONFIG = {
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
    'form button',
    'form input[type="submit"]'
  ],

  FORM_SELECTORS: [
    'form[action*="login" i]',
    'form[action*="signin" i]',
    'form[action*="auth" i]',
    'form:has(input[type="password"])'
  ],

  AUTOFILL_SERVER: 'http://localhost:47392',

  DEBOUNCE_DELAY: 300,

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
let autofillChecked = false;

// Firefox compatibility
const runtime =
  typeof browser !== 'undefined'
    ? browser.runtime
    : chrome.runtime;

// ===================== UTILITY FUNCTIONS =====================

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

function findElement(selectors, container = document) {
  for (const selector of selectors) {
    try {
      const element = container.querySelector(selector);

      if (element && element.offsetParent !== null) {
        return element;
      }
    } catch (e) {
      // Ignore invalid selectors
    }
  }

  return null;
}

function findAllElements(selectors, container = document) {
  for (const selector of selectors) {
    try {
      const elements = container.querySelectorAll(selector);

      if (elements.length > 0) {
        return Array.from(elements).filter(
          el => el.offsetParent !== null
        );
      }
    } catch (e) {
      // Ignore invalid selectors
    }
  }

  return [];
}

function detectFormFields() {
  const result = {
    username: null,
    password: null,
    submit: null,
    form: null
  };

  result.password = findElement(CONFIG.PASSWORD_SELECTORS);

  if (result.password) {
    const form = result.password.closest('form');

    if (form) {
      result.form = form;

      result.username = findElement(
        CONFIG.USERNAME_SELECTORS,
        form
      );

      result.submit = findElement(
        CONFIG.SUBMIT_SELECTORS,
        form
      );
    }
  }

  if (!result.username) {
    result.username = findElement(CONFIG.USERNAME_SELECTORS);
  }

  if (!result.form && result.username) {
    result.form = result.username.closest('form');
  }

  if (!result.submit && result.form) {
    result.submit = findElement(
      CONFIG.SUBMIT_SELECTORS,
      result.form
    );
  }

  return result;
}

function updateDetectedFields() {
  const fields = detectFormFields();

  detectedFields = fields;

  runtime.sendMessage({
    type: 'FIELDS_DETECTED',
    payload: {
      hasUsername: !!fields.username,
      hasPassword: !!fields.password,
      hasForm: !!fields.form,
      url: pageUrl,
      domain: domain
    }
  }).catch(() => {});

  return fields;
}

function setFieldValue(field, value) {
  const nativeInputValueSetter =
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

  field.focus();

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(field, value);
  } else {
    field.value = value;
  }

  field.dispatchEvent(
    new Event('input', { bubbles: true })
  );

  field.dispatchEvent(
    new Event('change', { bubbles: true })
  );

  field.dispatchEvent(
    new Event('blur', { bubbles: true })
  );
}

function highlightField(field, type = 'success') {
  const originalOutline = field.style.outline;
  const originalBackground = field.style.backgroundColor;

  const colors = {
    success: 'rgba(16, 185, 129, 0.3)',
    error: 'rgba(239, 68, 68, 0.3)',
    warning: 'rgba(245, 158, 11, 0.3)'
  };

  field.style.outline =
    `2px solid ${
      type === 'success'
        ? '#10B981'
        : '#EF4444'
    }`;

  field.style.backgroundColor =
    colors[type] || colors.success;

  setTimeout(() => {
    field.style.outline = originalOutline;
    field.style.backgroundColor =
      originalBackground;
  }, 1000);
}

function showFillIndicator(success) {
  const indicator = document.createElement('div');

  indicator.textContent =
    success
      ? '✓ Filled by AuraSafe'
      : '✗ Fill failed';

  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${
      success ? '#10B981' : '#EF4444'
    };
    color: white;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 12px;
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;

  document.body.appendChild(indicator);

  setTimeout(() => {
    indicator.remove();
  }, 2000);
}

function showNotification(message, type = 'info') {
  runtime.sendMessage({
    type: 'SHOW_NOTIFICATION',
    payload: { message, type }
  }).catch(() => {});
}

async function getSettings() {
  try {
    const response = await runtime.sendMessage({
      type: 'GET_SETTINGS'
    });

    return response || {
      autoSubmit: false,
      autoDetect: true
    };
  } catch {
    return {
      autoSubmit: false,
      autoDetect: true
    };
  }
}

async function checkForPendingAutofill() {
  if (autofillChecked) return;

  autofillChecked = true;

  try {
    const response = await fetch(
      `${CONFIG.AUTOFILL_SERVER}/pending-autofill`
    );

    const result = await response.json();

    if (result.success && result.data) {
      const {
        username,
        password,
        url,
        timestamp
      } = result.data;

      const isRecent =
        (Date.now() - timestamp) < 5000;

      const urlMatches =
        pageUrl.includes(url) ||
        url.includes(domain);

      if (
        isRecent &&
        urlMatches &&
        username &&
        password
      ) {
        console.log(
          '[AuraSafe] Found pending autofill for this page'
        );

        setTimeout(async () => {
          const fields = detectFormFields();

          if (fields.username && username) {
            setFieldValue(
              fields.username,
              username
            );

            highlightField(
              fields.username,
              'success'
            );
          }

          if (fields.password && password) {
            setFieldValue(
              fields.password,
              password
            );

            highlightField(
              fields.password,
              'success'
            );
          }

          showFillIndicator(true);

          await fetch(
            `${CONFIG.AUTOFILL_SERVER}/consume-autofill`,
            {
              method: 'POST'
            }
          );
        }, 500);
      }
    }
  } catch (error) {
    console.log(
      '[AuraSafe] Autofill server not available'
    );
  }
}

async function fillCredentials(entry) {
  if (!entry) {
    console.warn(
      '[AuraSafe] No entry provided for fill'
    );

    return false;
  }

  const fields = detectFormFields();

  if (!fields.username && !fields.password) {
    console.warn(
      '[AuraSafe] Could not find fillable fields'
    );

    showNotification(
      'Could not find username/password fields on this page',
      'error'
    );

    return false;
  }

  try {
    if (fields.username && entry.username) {
      setFieldValue(
        fields.username,
        entry.username
      );

      highlightField(
        fields.username,
        'success'
      );
    }

    if (fields.password && entry.password) {
      setFieldValue(
        fields.password,
        entry.password
      );

      highlightField(
        fields.password,
        'success'
      );
    }

    showFillIndicator(true);

    const settings = await getSettings();

    if (settings.autoSubmit && fields.submit) {
      setTimeout(() => {
        fields.submit.click();
      }, 500);
    }

    return true;
  } catch (error) {
    console.error(
      '[AuraSafe] Fill error:',
      error
    );

    showNotification(
      'Failed to fill credentials',
      'error'
    );

    return false;
  }
}

async function saveCredentials(
  username,
  password
) {
  return runtime.sendMessage({
    type: 'SAVE_CREDENTIALS',
    payload: {
      url: pageUrl,
      domain: domain,
      title: document.title,
      username,
      password
    }
  });
}

function watchForForms() {
  const observer = new MutationObserver(
    debounce(() => {
      const newFields =
        detectFormFields();

      if (
        newFields.password !==
          detectedFields.password ||
        newFields.username !==
          detectedFields.username
      ) {
        updateDetectedFields();
      }
    }, CONFIG.DEBOUNCE_DELAY)
  );

  observer.observe(
    document.body,
    CONFIG.OBSERVER_CONFIG
  );
}

function monitorFormSubmission() {
  document.addEventListener(
    'submit',
    event => {
      const form = event.target;

      if (!form) return;

      const passwordField =
        form.querySelector(
          'input[type="password"]'
        );

      if (!passwordField) return;

      const usernameField =
        form.querySelector(
          'input[type="text"], input[type="email"]'
        );

      const username =
        usernameField?.value || '';

      const password =
        passwordField.value;

      if (password) {
        runtime.sendMessage({
          type: 'FORM_SUBMITTED',
          payload: {
            url: pageUrl,
            domain: domain,
            title: document.title,
            username,
            password
          }
        }).catch(() => {});
      }
    }
  );
}

// ===================== MESSAGE HANDLING =====================

runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    const handleAsync = async () => {
      try {
        switch (request.type) {
          // ===================== NEW: INDIVIDUAL FILL TYPES =====================
          case 'FILL_BOTH': {
            console.log('[AuraSafe Content] Received FILL_BOTH:', request.payload);
            const { username, password } = request.payload;
            const fields = detectFormFields();
            
            let success = false;
            
            if (fields.username && username) {
              setFieldValue(fields.username, username);
              highlightField(fields.username, 'success');
              success = true;
            }
            
            if (fields.password && password) {
              setFieldValue(fields.password, password);
              highlightField(fields.password, 'success');
              success = true;
            }
            
            sendResponse({ success: success });
            break;
          }
          
          case 'FILL_USERNAME': {
            console.log('[AuraSafe Content] Received FILL_USERNAME:', request.payload);
            const { username } = request.payload;
            const fields = detectFormFields();
            
            if (fields.username && username) {
              setFieldValue(fields.username, username);
              highlightField(fields.username, 'success');
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, error: 'Username field not found' });
            }
            break;
          }
          
          case 'FILL_PASSWORD': {
            console.log('[AuraSafe Content] Received FILL_PASSWORD:', request.payload);
            const { password } = request.payload;
            const fields = detectFormFields();
            
            if (fields.password && password) {
              setFieldValue(fields.password, password);
              highlightField(fields.password, 'success');
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, error: 'Password field not found' });
            }
            break;
          }

          // Existing: Legacy FILL type
          case 'FILL':
            const success =
              await fillCredentials(
                request.payload
              );

            sendResponse({ success });
            break;

          case 'DETECT_FIELDS':
            const fields =
              updateDetectedFields();

            sendResponse({
              success: true,
              fields: {
                hasUsername:
                  !!fields.username,
                hasPassword:
                  !!fields.password,
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
            if (detectedFields.username) {
              highlightField(
                detectedFields.username,
                'warning'
              );
            }

            if (detectedFields.password) {
              highlightField(
                detectedFields.password,
                'warning'
              );
            }

            sendResponse({
              success: true
            });

            break;

          default:
            sendResponse({
              success: false,
              error:
                'Unknown message type'
            });
        }
      } catch (error) {
        console.error(
          '[AuraSafe] Message handler error:',
          error
        );

        sendResponse({
          success: false,
          error: error.message
        });
      }
    };

    handleAsync();

    return true;
  }
);

function init() {
  updateDetectedFields();

  watchForForms();

  monitorFormSubmission();

  checkForPendingAutofill();

  runtime.sendMessage({
    type: 'CONTENT_SCRIPT_READY',
    payload: {
      url: pageUrl,
      domain: domain
    }
  }).catch(() => {});

  console.log(
    '[AuraSafe] Firefox content script initialized for',
    domain
  );
}

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

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    init
  );
} else {
  init();
}
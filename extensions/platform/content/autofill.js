if (!globalThis.__aurasafeAutofillInstalled) {
  globalThis.__aurasafeAutofillInstalled = true;

  function visibleInput(input) {
    if (!input || input.disabled || input.readOnly) return false;
    const style = window.getComputedStyle(input);
    const rect = input.getBoundingClientRect();
    return (
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      Number(style.opacity) !== 0 &&
      rect.width >= 20 &&
      rect.height >= 12
    );
  }

  function fieldScore(input, keywords) {
    const text = [
      input.name,
      input.id,
      input.getAttribute('autocomplete'),
      input.getAttribute('aria-label'),
      input.placeholder,
      input.labels ? [...input.labels].map((label) => label.textContent).join(' ') : '',
    ].filter(Boolean).join(' ').toLowerCase();

    return keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);
  }

  function findUsernameField() {
    const fields = [...document.querySelectorAll('input')]
      .filter((input) => {
        const type = (input.getAttribute('type') || 'text').toLowerCase();
        return ['text', 'email', 'search', 'tel', 'url'].includes(type) && visibleInput(input);
      })
      .map((input) => ({
        input,
        score: fieldScore(input, ['user', 'email', 'login', 'account', 'identifier']),
      }))
      .sort((a, b) => b.score - a.score);

    return fields[0]?.input || null;
  }

  function findPasswordField() {
    return [...document.querySelectorAll('input[type="password"]')].find(visibleInput) || null;
  }

  function highlight(input) {
    if (!input) return;
    input.classList.add('aurasafe-fill-highlight');
    window.setTimeout(() => input.classList.remove('aurasafe-fill-highlight'), 1200);
  }

  function setInputValue(input, value) {
    if (!input || value == null) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    highlight(input);
    return true;
  }

  function fillEntry(entry) {
    if (!entry) {
      return { success: false, error: 'Missing entry' };
    }

    const username = entry.username || entry.email || entry.login;
    const password = entry.password;
    const usernameField = findUsernameField();
    const passwordField = findPasswordField();

    const usernameFilled = setInputValue(usernameField, username);
    const passwordFilled = setInputValue(passwordField, password);

    if (usernameField || passwordField) {
      (passwordField || usernameField).focus();
    }

    return {
      success: usernameFilled || passwordFilled,
      usernameFilled,
      passwordFilled,
      fieldsFound: {
        username: Boolean(usernameField),
        password: Boolean(passwordField),
      },
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'aurasafe.content.fill') {
      return false;
    }

    try {
      sendResponse(fillEntry(message.entry));
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  });
}

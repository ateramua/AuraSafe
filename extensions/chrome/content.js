chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'fill') {
    const { entry } = request;
    // Auto-fill logic: find username/password fields
    const usernameField = document.querySelector('input[type="text"], input[name*="user"], input[name*="email"]');
    const passwordField = document.querySelector('input[type="password"]');
    if (usernameField && passwordField) {
      usernameField.value = entry.username || '';
      passwordField.value = entry.password || '';
      // Dispatch events so website detects change
      usernameField.dispatchEvent(new Event('input', { bubbles: true }));
      passwordField.dispatchEvent(new Event('input', { bubbles: true }));
    }
    sendResponse({ success: true });
  }
});
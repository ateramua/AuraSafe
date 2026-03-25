const searchInput = document.getElementById('search');
const list = document.getElementById('list');
const statusDiv = document.getElementById('status');

async function loadEntries() {
  const response = await chrome.runtime.sendMessage({ action: 'getEntries' });
  if (response.status === 'disconnected') {
    statusDiv.textContent = 'Not connected to AuraSafe desktop app.';
    return;
  }
  // Wait for response via chrome.storage
  chrome.storage.local.get(['lastMessage'], (result) => {
    const msg = result.lastMessage;
    if (msg && msg.type === 'entries') {
      renderEntries(msg.entries);
    }
  });
}

function renderEntries(entries) {
  list.innerHTML = '';
  const filter = searchInput.value.toLowerCase();
  entries.forEach(entry => {
    if (entry.name.toLowerCase().includes(filter)) {
      const li = document.createElement('li');
      li.textContent = entry.name;
      li.onclick = () => {
        // Send entry to active tab
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'fill', entry });
        });
      };
      list.appendChild(li);
    }
  });
}

searchInput.addEventListener('input', () => {
  chrome.storage.local.get(['lastMessage'], (result) => {
    if (result.lastMessage && result.lastMessage.type === 'entries') {
      renderEntries(result.lastMessage.entries);
    }
  });
});

loadEntries();
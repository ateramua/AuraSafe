document.getElementById('openVault').addEventListener('click', async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });

  console.log('Current tab:', tabs[0]);

  alert('AuraSafe extension working');
});
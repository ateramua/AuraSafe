const runtime = globalThis.browser ?? globalThis.chrome;

export function getRuntime() {
  if (!runtime) {
    throw new Error('Browser extension runtime is unavailable');
  }
  return runtime;
}

export function getLastRuntimeError() {
  if (globalThis.chrome?.runtime?.lastError) {
    return globalThis.chrome.runtime.lastError;
  }
  if (globalThis.browser?.runtime?.lastError) {
    return globalThis.browser.runtime.lastError;
  }
  return null;
}

export function sendRuntimeMessage(message) {
  const api = getRuntime();
  return new Promise((resolve, reject) => {
    try {
      const result = api.runtime.sendMessage(message, (response) => {
        const err = getLastRuntimeError();
        if (err) {
          reject(new Error(err.message || String(err)));
          return;
        }
        resolve(response);
      });
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

export function storageGet(keys) {
  const api = getRuntime();
  return new Promise((resolve, reject) => {
    try {
      const result = api.storage.local.get(keys, (items) => {
        const err = getLastRuntimeError();
        if (err) {
          reject(new Error(err.message || String(err)));
          return;
        }
        resolve(items || {});
      });
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

export function storageSet(items) {
  const api = getRuntime();
  return new Promise((resolve, reject) => {
    try {
      const result = api.storage.local.set(items, () => {
        const err = getLastRuntimeError();
        if (err) {
          reject(new Error(err.message || String(err)));
          return;
        }
        resolve();
      });
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

export function storageRemove(keys) {
  const api = getRuntime();
  return new Promise((resolve, reject) => {
    try {
      const result = api.storage.local.remove(keys, () => {
        const err = getLastRuntimeError();
        if (err) {
          reject(new Error(err.message || String(err)));
          return;
        }
        resolve();
      });
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

export function tabsQuery(queryInfo) {
  const api = getRuntime();
  return new Promise((resolve, reject) => {
    try {
      const result = api.tabs.query(queryInfo, (tabs) => {
        const err = getLastRuntimeError();
        if (err) {
          reject(new Error(err.message || String(err)));
          return;
        }
        resolve(tabs || []);
      });
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

export function tabsSendMessage(tabId, message) {
  const api = getRuntime();
  return new Promise((resolve, reject) => {
    try {
      const result = api.tabs.sendMessage(tabId, message, (response) => {
        const err = getLastRuntimeError();
        if (err) {
          reject(new Error(err.message || String(err)));
          return;
        }
        resolve(response);
      });
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

export function executeScript(details) {
  const api = getRuntime();
  if (!api.scripting?.executeScript) {
    return Promise.reject(new Error('Programmatic script injection is unavailable in this browser'));
  }
  return api.scripting.executeScript(details);
}

export function insertCSS(details) {
  const api = getRuntime();
  if (!api.scripting?.insertCSS) {
    return Promise.resolve();
  }
  return api.scripting.insertCSS(details);
}

export function openOptionsPage() {
  const api = getRuntime();
  if (!api.runtime?.openOptionsPage) {
    return Promise.resolve();
  }
  return api.runtime.openOptionsPage();
}

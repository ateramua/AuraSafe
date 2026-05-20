import { getRuntime } from '../browser/runtime.js';

function permissionsContains(details) {
  const api = getRuntime();
  if (!api.permissions?.contains) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    api.permissions.contains(details, (result) => resolve(Boolean(result)));
  });
}

function permissionsRequest(details) {
  const api = getRuntime();
  if (!api.permissions?.request) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    api.permissions.request(details, (result) => resolve(Boolean(result)));
  });
}

/** Must run from popup/sidepanel click handler (user gesture), not the service worker. */
export async function ensureLaunchAccess(url) {
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }

  const origins = [`${origin}/*`];
  if (await permissionsContains({ origins })) {
    return true;
  }

  if (await permissionsRequest({ origins })) {
    return true;
  }

  if (await permissionsContains({ permissions: ['<all_urls>'] })) {
    return true;
  }

  return permissionsRequest({ permissions: ['<all_urls>'] });
}

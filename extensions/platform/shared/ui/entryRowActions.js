import { sendRuntimeMessage } from '../browser/runtime.js';
import { ExtensionMessageType } from '../bridge/protocol.js';
import { ensureLaunchAccess } from '../domain/launchAccess.js';
import { entryHasLaunchUrl, normalizeEntryUrl } from '../domain/entryUrl.js';

function resetLaunchButton(launch, entry) {
  launch.textContent = 'Launch';
  launch.disabled = !entryHasLaunchUrl(entry);
}

export function createEntryActions(entry, { primaryClass = 'primary' } = {}) {
  const actions = document.createElement('div');
  actions.className = 'entry-actions';

  const fill = document.createElement('button');
  fill.type = 'button';
  fill.className = primaryClass;
  const canFill = entry.fillAvailable !== false && !entry.offlineOnly;
  fill.textContent = canFill ? 'Fill' : 'Browse';
  fill.disabled = !canFill;
  fill.addEventListener('click', async () => {
    if (!canFill) {
      return;
    }
    fill.disabled = true;
    fill.textContent = 'Filling';
    try {
      const response = await sendRuntimeMessage({
        type: ExtensionMessageType.fillEntry,
        entry,
      });
      fill.textContent = response?.ok ? 'Filled' : 'Retry';
      if (!response?.ok) {
        fill.title = response?.error || 'Fill failed';
      }
    } catch (error) {
      fill.textContent = 'Retry';
      fill.title = error.message;
    }
    fill.disabled = false;
  });

  const launch = document.createElement('button');
  launch.type = 'button';
  launch.className = 'launch';
  launch.textContent = 'Launch';
  launch.disabled = !entryHasLaunchUrl(entry);
  launch.title = launch.disabled ? 'No website URL saved for this entry' : 'Open website in a new tab';
  launch.addEventListener('click', async () => {
    const url = normalizeEntryUrl(entry);
    if (!url) {
      launch.title = 'No website URL saved for this entry';
      return;
    }

    launch.disabled = true;
    launch.textContent = 'Opening';
    launch.title = 'Open website in a new tab';

    try {
      const allowed = await ensureLaunchAccess(url);
      if (!allowed) {
        launch.textContent = 'Denied';
        launch.title = 'Allow site access when prompted, then click Launch again.';
        launch.disabled = false;
        return;
      }

      const response = await sendRuntimeMessage({
        type: ExtensionMessageType.launchEntry,
        entry,
      });

      if (response?.ok) {
        launch.textContent = response.result?.copied ? 'Copied' : 'Opened';
        window.setTimeout(() => resetLaunchButton(launch, entry), 1200);
        return;
      }

      launch.textContent = 'Retry';
      launch.title = response?.error || 'Could not open website';
      launch.disabled = false;
    } catch (error) {
      launch.textContent = 'Retry';
      launch.title = error.message || 'Could not open website';
      launch.disabled = false;
    }
  });

  actions.append(fill, launch);
  return actions;
}

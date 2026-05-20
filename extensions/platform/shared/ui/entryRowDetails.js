import {
  entryHostLabel,
  entryLoginIdentifier,
  maskPassword,
  maskValue,
} from '../domain/maskValue.js';

function appendFieldRow(parent, label, value) {
  const row = document.createElement('div');
  row.className = 'entry-field';

  const labelEl = document.createElement('span');
  labelEl.className = 'entry-field-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'entry-field-value';
  valueEl.textContent = value;

  row.append(labelEl, valueEl);
  parent.append(row);
}

/** Build name + masked credential rows (same pattern as desktop CategoryModal). */
export function populateEntryDetails(detailsEl, entry) {
  const login = entryLoginIdentifier(entry);
  if (login) {
    appendFieldRow(detailsEl, 'Username:', maskValue(login));
  }
  if (entry?.password) {
    appendFieldRow(detailsEl, 'Password:', maskPassword());
  }

  const host = entryHostLabel(entry);
  if (host) {
    const meta = document.createElement('div');
    meta.className = 'entry-meta';
    meta.textContent = host;
    detailsEl.append(meta);
  }
}

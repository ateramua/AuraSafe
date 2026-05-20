/**
 * RFC-style CSV parser (quoted fields, escaped quotes, multiline fields).
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }

    if (char === '\r') {
      i += 1;
      continue;
    }

    if (char === '\n') {
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') {
        rows.push(row);
      }
      row = [];
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * @param {string} text
 * @returns {{ headers: string[], records: Record<string, string>[] }}
 */
export function parseCsvRecords(text) {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  if (!rows.length) {
    return { headers: [], records: [] };
  }

  const headers = rows[0].map((header) => header.trim());
  const records = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const cells = rows[rowIndex];
    const record = {};
    for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
      const key = headers[columnIndex];
      if (!key) continue;
      record[key] = cells[columnIndex] ?? '';
    }
    records.push(record);
  }

  return { headers, records };
}

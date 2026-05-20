import { useState } from 'react';

export default function CredentialCsvImport({ api, onImportComplete }) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [filePath, setFilePath] = useState('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [message, setMessage] = useState('');

  const handlePreview = async () => {
    if (!api?.previewCredentialsCsv) {
      setMessage('CSV import is only available in the desktop app.');
      return;
    }

    setLoading(true);
    setMessage('');
    setPreview(null);
    setFilePath('');

    try {
      const result = await api.previewCredentialsCsv();
      if (result.canceled) {
        setMessage('Preview canceled.');
        return;
      }
      if (!result.success) {
        setMessage(result.error || 'Preview failed.');
        return;
      }

      setPreview(result.preview);
      setFilePath(result.filePath || '');
      setMessage(
        `Ready to import ${result.preview.importable} credential(s) from ${result.preview.totalRows} row(s).`
      );
    } catch (error) {
      setMessage(error.message || 'Preview failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!api?.importCredentialsCsv) {
      setMessage('CSV import is only available in the desktop app.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const result = await api.importCredentialsCsv({
        filePath: filePath || undefined,
        skipDuplicates,
      });

      if (result.canceled) {
        setMessage('Import canceled.');
        return;
      }

      if (!result.success) {
        setMessage(result.error || 'Import failed.');
        return;
      }

      setMessage(
        `Imported ${result.imported} credential(s). Skipped ${result.skipped} row(s) ` +
          `(${result.skippedIncomplete} missing username/password, ` +
          `${result.skippedSecureNotes} note-only rows, ` +
          `${result.skippedDuplicates} duplicates).`
      );

      if (onImportComplete) {
        const entries = await api.getVaultEntries();
        onImportComplete(entries);
      }
    } catch (error) {
      setMessage(error.message || 'Import failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <p className="setting-description">
        Import logins from a standard CSV file. Each row must include{' '}
        <strong>username</strong> and <strong>password</strong>. Optional columns:{' '}
        <strong>url</strong>, <strong>name</strong> (title), and <strong>extra</strong> /{' '}
        <strong>notes</strong>. You can add or edit URLs in AuraSafe after import.
      </p>

      <label className="import-option">
        <input
          type="checkbox"
          checked={skipDuplicates}
          onChange={(event) => setSkipDuplicates(event.target.checked)}
        />
        Skip rows that match an existing entry (same username and URL when URL is present)
      </label>

      <div className="sync-buttons" style={{ marginTop: '1rem' }}>
        <button type="button" onClick={handlePreview} disabled={loading} className="sync-button">
          {loading ? 'Working…' : 'Preview CSV'}
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={loading}
          className="sync-button push-button"
        >
          {loading ? 'Importing…' : 'Import from CSV'}
        </button>
      </div>

      {preview && (
        <div className="import-preview" style={{ marginTop: '1rem' }}>
          <div style={{ color: '#c8e6c9', fontSize: '0.9rem' }}>
            <div>Total rows: {preview.totalRows}</div>
            <div>Importable: {preview.importable}</div>
            <div>Missing username/password: {preview.incomplete}</div>
            {preview.secureNotes > 0 && (
              <div>Note-only rows skipped: {preview.secureNotes}</div>
            )}
          </div>
          {preview.sample?.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <strong style={{ color: '#eef5ff' }}>Sample entries</strong>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem', color: '#d1fae5' }}>
                {preview.sample.map((row) => (
                  <li key={`${row.title}-${row.username}-${row.url}`}>
                    {row.title} — {row.username} @ {row.url}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {message && (
        <div
          className={`sync-message ${message.includes('Imported') ? 'success' : 'info'}`}
          style={{ marginTop: '1rem' }}
        >
          {message}
        </div>
      )}

      <style jsx>{`
        .import-option {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #c8e6c9;
          font-size: 0.9rem;
          margin-top: 0.75rem;
        }
      `}</style>
    </>
  );
}

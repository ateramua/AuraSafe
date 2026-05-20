/**
 * Shown after a backup file was loaded for pre-vault restore.
 */
export default function RestoreStatusBanner({ meta, variant = 'success' }) {
  if (!meta?.entriesCount) return null;

  const isSuccess = variant === 'success';
  const fileLabel =
    meta.source === 'icloud' ? 'iCloud backup' : meta.fileName || 'backup file';

  return (
    <div
      role="status"
      style={{
        marginBottom: '1.25rem',
        padding: '1rem 1.25rem',
        borderRadius: '0.75rem',
        border: isSuccess ? '1px solid #4caf50' : '1px solid #f59e0b',
        background: isSuccess ? 'rgba(76, 175, 80, 0.15)' : 'rgba(245, 158, 11, 0.12)',
        color: isSuccess ? '#c8e6c9' : '#fde68a',
        lineHeight: 1.5,
        fontSize: '0.95rem',
      }}
    >
      <strong style={{ display: 'block', marginBottom: '0.35rem', color: '#fff' }}>
        {isSuccess ? '✅ Backup loaded successfully' : '⏳ Backup ready to restore'}
      </strong>
      <span>
        {meta.encrypted ? 'Decrypted and loaded' : 'Loaded'}{' '}
        <strong>{meta.entriesCount}</strong> {meta.entriesCount === 1 ? 'entry' : 'entries'} from{' '}
        <strong>{fileLabel}</strong>.
      </span>
      {isSuccess && (
        <span style={{ display: 'block', marginTop: '0.5rem', opacity: 0.9 }}>
          Go to <strong>Vault</strong>, enter a master password, and click{' '}
          <strong>Restore Vault</strong> to import them.
        </span>
      )}
    </div>
  );
}

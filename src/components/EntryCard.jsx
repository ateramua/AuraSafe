export default function EntryCard({ entry, onEdit, onDelete }) {
  return (
    <div style={styles.card}>
      <div onClick={() => onEdit(entry)} style={styles.content}>
        <div>🔑 {entry.title || 'Untitled'}</div>
        {entry.username && <div>{entry.username}</div>}
        {entry.url && <div>{entry.url}</div>}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(entry.id);
        }}
        style={styles.delete}
      >
        🗑️
      </button>
    </div>
  );
}

const styles = {
  card: {
    background: '#2e7d32',
    padding: '1rem',
    borderRadius: '10px',
    color: '#fff',
    display: 'flex',
    justifyContent: 'space-between',
    cursor: 'pointer',
  },
  content: {
    flex: 1,
  },
  delete: {
    background: 'transparent',
    border: 'none',
    color: '#ff6b6b',
    cursor: 'pointer',
  },
};
// src/components/EntryCard.jsx
export default function EntryCard({ entry, onEdit, onDelete }) {
  return (
    <div className="entry-card">
      <div className="entry-card-content" onClick={() => onEdit(entry)}>
        <div className="entry-icon">🔑</div>
        <div className="entry-details">
          <div className="entry-name">{entry.name}</div>
          <div className="entry-username">{entry.username}</div>
          {entry.url && <div className="entry-url">{entry.url}</div>}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
        className="delete-button"
        title="Delete entry"
      >
        🗑️
      </button>
    </div>
  );
}
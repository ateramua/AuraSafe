import React from 'react';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  ...props
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className={['modal-card', className].filter(Boolean).join(' ')} {...props}>
        <div className="modal-card-header">
          {title && <h2 className="modal-card-title">{title}</h2>}
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>
        <div className="modal-card-body">{children}</div>
      </div>
    </div>
  );
}

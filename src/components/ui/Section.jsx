import React from 'react';

export default function Section({
  title,
  description,
  children,
  className = '',
  ...props
}) {
  return (
    <section className={['section-card', className].filter(Boolean).join(' ')} {...props}>
      {(title || description) && (
        <div className="section-card-header">
          {title && <h2 className="section-card-title">{title}</h2>}
          {description && <p className="section-card-description">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

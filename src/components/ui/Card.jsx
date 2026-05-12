import React from 'react';

export default function Card({ className = '', children, ...props }) {
  return (
    <div className={['card', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}

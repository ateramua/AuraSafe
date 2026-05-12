import React from 'react';

export default function Button({
  type = 'button',
  variant = 'primary',
  size = 'default',
  className = '',
  children,
  ...props
}) {
  const classes = ['button', `button-${variant}`, `button-${size}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}

import type { ButtonHTMLAttributes, JSX } from 'react';

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element {
  return <button type="button" {...props} className={`button ${className}`} />;
}

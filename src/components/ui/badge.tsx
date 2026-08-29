import * as React from 'react'

export function Badge({ className = '', variant = 'default', ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'success' | 'warning' | 'neutral' }) {
  const variants = {
    default: 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20 text-[var(--color-primary)]',
    success: 'bg-[var(--color-success)]/10 border-[var(--color-success)]/20 text-[var(--color-success)]',
    warning: 'bg-[var(--color-warning)]/10 border-[var(--color-warning)]/20 text-[var(--color-warning)]',
    neutral: 'bg-[var(--color-background-secondary)] border-[var(--color-border)] text-[var(--color-foreground-secondary)]',
  }
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${variants[variant]} ${className}`} {...props} />
}

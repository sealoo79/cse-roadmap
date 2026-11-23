import type { JSX, ReactNode } from 'react';

export function EmptyState({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return <section className="empty-state"><h2>{title}</h2><p>{children}</p></section>;
}

import type { ReactNode } from 'react';

interface InfoCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function InfoCard({ title, children, className = '' }: InfoCardProps) {
  return (
    <section
      className={`rounded-2xl bg-surface p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_2px_8px_rgb(0_0_0/0.06)] ${className}`}
    >
      {title && <h2 className="mb-2 text-sm font-semibold text-gray-500">{title}</h2>}
      {children}
    </section>
  );
}

'use client';

import type { Session } from 'next-auth';

export function Topbar({ session }: { session: Session }) {
  const initials = session.user?.name
    ?.split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  return (
    <header className="h-14 shrink-0 flex items-center justify-end px-6 border-b bg-background gap-3">
      <span className="text-sm text-muted-foreground hidden sm:block">{session.user?.name}</span>
      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold select-none">
        {initials}
      </div>
    </header>
  );
}

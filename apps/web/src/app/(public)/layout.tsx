'use client';

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';

function PublicHeader() {
  const { data } = useQuery<{ businessName: string }>({
    queryKey: ['settings-public'],
    queryFn: () => apiFetch('/settings/public'),
    staleTime: 5 * 60_000,
  });
  const name = data?.businessName ?? 'Reservo';

  return (
    <header className="border-b bg-background sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold">
          {name}
        </Link>
        <nav className="text-sm space-x-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            Inicio
          </Link>
          <Link href="/reservar" className="text-muted-foreground hover:text-foreground transition-colors">
            Reservar
          </Link>
          <Link href="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
            Staff
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <SessionProvider session={null}>
      <QueryClientProvider client={queryClient}>
        <div className="flex flex-col min-h-screen bg-background">
          <PublicHeader />

          <main className="flex-1">
            {children}
          </main>

          <footer className="border-t bg-muted/30 text-center py-6 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} Reservo. Plataforma de reserva de canchas.</p>
          </footer>
        </div>
      </QueryClientProvider>
    </SessionProvider>
  );
}

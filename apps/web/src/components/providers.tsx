'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { signOut, useSession, SessionProvider } from 'next-auth/react';
import { useEffect, useState } from 'react';
import type { Session } from 'next-auth';

// Listens for 401 events from apiFetch and for RefreshTokenExpired on the session.
// Either way → force signOut so the user lands on /login.
function SessionWatcher() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.error === 'RefreshTokenExpired') {
      signOut({ callbackUrl: '/login' });
    }
  }, [session?.error]);

  useEffect(() => {
    function handleUnauthorized() {
      signOut({ callbackUrl: '/login' });
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  return null;
}

function InnerProviders({ children }: { children: React.ReactNode }) {
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
    <QueryClientProvider client={queryClient}>
      <SessionWatcher />
      {children}
    </QueryClientProvider>
  );
}

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <InnerProviders>{children}</InnerProviders>
    </SessionProvider>
  );
}

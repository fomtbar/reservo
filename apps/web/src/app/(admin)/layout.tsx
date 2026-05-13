import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Providers } from '@/components/providers';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.error === 'RefreshTokenExpired') redirect('/login');

  return (
    <Providers session={session}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <Topbar session={session} />
          <main className="flex-1 overflow-auto p-6 bg-muted/30">{children}</main>
        </div>
      </div>
    </Providers>
  );
}

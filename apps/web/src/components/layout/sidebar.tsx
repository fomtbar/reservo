'use client';

import { cn } from '@/lib/utils';
import {
  BookOpen,
  Building2,
  Calendar,
  ClockArrowDown,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  LogOut,
  Settings,
  Tag,
  Ticket,
  Users,
  Wallet,
  BarChart3,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/bookings', label: 'Reservas', icon: BookOpen },
  { href: '/waitlist', label: 'Lista espera', icon: ClockArrowDown },
  { href: '/caja', label: 'Caja', icon: Wallet },
  { href: '/reports', label: 'Reportes', icon: BarChart3 },
  { href: '/stats', label: 'Estadísticas', icon: LineChart },
  { href: '/branches', label: 'Sucursales', icon: Building2 },
  { href: '/courts', label: 'Canchas', icon: LayoutGrid },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/pricing', label: 'Precios', icon: Tag },
  { href: '/promos', label: 'Promociones', icon: Ticket },
  { href: '/settings', label: 'Configuración', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-accent">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-sidebar-accent">
        <span className="text-base font-semibold tracking-tight">Reservo</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-foreground'
                  : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-accent">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Salir
        </button>
      </div>
    </aside>
  );
}

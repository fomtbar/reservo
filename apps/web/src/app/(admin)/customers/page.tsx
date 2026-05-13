'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type LoyaltyTier = 'NONE' | 'SILVER' | 'GOLD';

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  totalBookings: number;
  lastBookingAt: string | null;
  createdAt: string;
  _count: { bookings: number };
  loyalty: { tier: LoyaltyTier; discountPct: number };
};

const TIER_BADGE: Record<LoyaltyTier, { label: string; className: string }> = {
  NONE: { label: '', className: '' },
  SILVER: { label: 'Silver', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  GOLD: { label: 'Gold', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
};

type CustomerPage = {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
};

export default function CustomersPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery<CustomerPage>({
    queryKey: ['customers', search, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('q', search);
      return apiFetch(`/customers?${params}`, { token });
    },
    enabled: !!token,
    placeholderData: (prev) => prev,
  });

  const customers = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total > 0 ? `${total} cliente${total !== 1 ? 's' : ''}` : 'Buscá por nombre o teléfono'}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, teléfono o email…"
          className="pl-9"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-background overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {search ? 'Sin resultados para esa búsqueda.' : 'No hay clientes registrados.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Teléfono</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Email</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Reservas</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Fidelidad</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Última visita</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{c.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {c.email ?? <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge variant={c._count.bookings > 0 ? 'default' : 'secondary'}>
                      {c._count.bookings}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {c.loyalty.tier !== 'NONE' && (
                      <Badge className={TIER_BADGE[c.loyalty.tier].className}>
                        {TIER_BADGE[c.loyalty.tier].label} {c.loyalty.discountPct > 0 && `−${c.loyalty.discountPct}%`}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {c.lastBookingAt
                      ? formatDate(c.lastBookingAt, { day: '2-digit', month: 'short', year: 'numeric' })
                      : <span className="text-muted-foreground/50">Nunca</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

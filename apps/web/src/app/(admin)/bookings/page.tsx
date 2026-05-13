'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { BookingDetail, type BookingEvent } from '@/components/agenda/booking-detail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

type Court = { id: string; name: string };

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'HELD', label: 'En espera' },
  { value: 'CONFIRMED', label: 'Confirmadas' },
  { value: 'COMPLETED', label: 'Completadas' },
  { value: 'CANCELLED', label: 'Canceladas' },
  { value: 'NO_SHOW', label: 'No-show' },
];

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'secondary' | 'destructive' | 'default'> = {
  HELD: 'warning',
  CONFIRMED: 'success',
  CANCELLED: 'secondary',
  COMPLETED: 'default',
  NO_SHOW: 'destructive',
};

const STATUS_LABEL: Record<string, string> = {
  HELD: 'En espera',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
  NO_SHOW: 'No-show',
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function BookingsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [detail, setDetail] = useState<BookingEvent | null>(null);
  const [statusFilter, setStatusFilter] = useState('HELD,CONFIRMED');
  const [courtFilter, setCourtFilter] = useState('');
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');

  const { data: courts = [] } = useQuery<Court[]>({
    queryKey: ['courts'],
    queryFn: () => apiFetch('/courts', { token }),
    enabled: !!token,
  });

  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  if (courtFilter) params.set('courtId', courtFilter);
  if (from) params.set('from', from);
  if (to) params.set('to', to + 'T23:59:59Z');

  const { data: bookings = [], isLoading } = useQuery<BookingEvent[]>({
    queryKey: ['bookings-list', statusFilter, courtFilter, from, to],
    queryFn: () => apiFetch(`/bookings?${params}`, { token }),
    enabled: !!token,
  });

  const searchLower = search.toLowerCase();
  const filtered = search
    ? bookings.filter(
        (b) =>
          b.customer?.name.toLowerCase().includes(searchLower) ||
          b.customer?.phone.includes(search) ||
          b.court.name.toLowerCase().includes(searchLower),
      )
    : bookings;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Reservas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Historial y estado de todas las reservas.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Status */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Estado</p>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-9 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Court */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Cancha</p>
          <select
            value={courtFilter}
            onChange={(e) => setCourtFilter(e.target.value)}
            className="flex h-9 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <option value="">Todas</option>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Date from */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Desde</p>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="flex h-9 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        {/* Date to */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Hasta</p>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="flex h-9 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        {/* Reset */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setStatusFilter('HELD,CONFIRMED'); setCourtFilter(''); setFrom(todayStr()); setTo(''); setSearch(''); }}
        >
          Limpiar
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente, teléfono, cancha…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-background py-16 text-center text-sm text-muted-foreground">
          No hay reservas con los filtros seleccionados
        </div>
      ) : (
        <div className="rounded-xl border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Inicio</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Cancha</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Estado</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Precio</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Pagado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((b) => (
                <tr
                  key={b.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setDetail(b)}
                >
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground whitespace-nowrap">
                    {formatDate(b.startsAt, { weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{b.court.name}</td>
                  <td className="px-4 py-2.5">
                    {b.customer
                      ? <span>{b.customer.name} <span className="text-muted-foreground text-xs">{b.customer.phone}</span></span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={STATUS_VARIANT[b.status] ?? 'secondary'}>
                      {STATUS_LABEL[b.status] ?? b.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(b.price)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    <span className={parseFloat(b.paidAmount) >= parseFloat(b.price) && parseFloat(b.price) > 0 ? 'text-green-600 font-medium' : ''}>
                      {formatCurrency(b.paidAmount)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
            {filtered.length} reserva{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      <BookingDetail booking={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

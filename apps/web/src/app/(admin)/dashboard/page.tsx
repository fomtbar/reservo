'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

type DashboardData = {
  today: {
    date: string;
    bookings: {
      confirmed: number;
      held: number;
      completed: number;
      cancelled: number;
      noShow: number;
    };
    revenue: number;
  };
  week: {
    revenue: Array<{ date: string; amount: number }>;
    total: number;
  };
  month: { revenue: number };
  pendingHolds: Array<{
    id: string;
    heldUntil: string;
    startsAt: string;
    court: { id: string; name: string };
    customer: { id: string; name: string; phone: string } | null;
  }>;
  topCourts: Array<{
    id: string;
    name: string;
    color: string;
    bookingsCount: number;
  }>;
};

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-5 space-y-1 ${accent ? 'bg-primary text-primary-foreground' : 'bg-background'}`}>
      <p className={`text-xs font-medium ${accent ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className={`text-xs ${accent ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{sub}</p>}
    </div>
  );
}

function WeekChart({ data }: { data: Array<{ date: string; amount: number }> }) {
  const max = Math.max(...data.map((d) => d.amount), 1);
  return (
    <div className="flex items-end gap-1.5 h-24 pt-2">
      {data.map((d) => {
        const pct = (d.amount / max) * 100;
        const label = d.date.slice(5).replace('-', '/');
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="w-full relative" style={{ height: '80px' }}>
              <div
                className="absolute bottom-0 w-full bg-primary/70 rounded-t group-hover:bg-primary transition-colors"
                style={{ height: `${Math.max(pct, d.amount > 0 ? 4 : 0)}%` }}
                title={formatCurrency(String(d.amount))}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function minutesUntil(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const router = useRouter();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch('/dashboard', { token }),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>;
  }

  const totalToday =
    data.today.bookings.confirmed +
    data.today.bookings.held +
    data.today.bookings.completed;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5 capitalize">
          {formatDate(data.today.date + 'T12:00:00Z', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Reservas hoy" value={totalToday} sub={`${data.today.bookings.confirmed} confirmadas`} />
        <KpiCard
          label="En espera"
          value={data.today.bookings.held}
          sub={data.today.bookings.held > 0 ? 'Pendientes de confirmar' : 'Sin holds pendientes'}
        />
        <KpiCard label="Recaudación hoy" value={formatCurrency(String(data.today.revenue))} accent />
        <KpiCard label="Recaudación mes" value={formatCurrency(String(data.month.revenue))} />
      </div>

      {/* Charts + holds row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Weekly revenue chart */}
        <div className="rounded-xl border bg-background p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recaudación últimos 7 días</h2>
            <span className="text-sm font-bold tabular-nums">{formatCurrency(String(data.week.total))}</span>
          </div>
          <WeekChart data={data.week.revenue} />
        </div>

        {/* Top courts */}
        <div className="rounded-xl border bg-background p-5 space-y-3">
          <h2 className="text-sm font-semibold">Top canchas esta semana</h2>
          {data.topCourts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos aún</p>
          ) : (
            <div className="space-y-2">
              {data.topCourts.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: c.color ?? '#3b82f6' }}
                  />
                  <span className="text-sm flex-1">{c.name}</span>
                  <span className="text-sm font-medium tabular-nums">{c.bookingsCount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending holds */}
      {data.pendingHolds.length > 0 && (
        <div className="rounded-xl border bg-background overflow-hidden">
          <div className="px-4 py-3 border-b bg-warning/10 flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            <h2 className="text-sm font-semibold">
              Holds pendientes de confirmar ({data.pendingHolds.length})
            </h2>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {data.pendingHolds.map((h) => (
                <tr
                  key={h.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => router.push('/bookings')}
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{h.court.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {formatDate(h.startsAt, { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {h.customer
                      ? <span>{h.customer.name} <span className="text-muted-foreground text-xs">{h.customer.phone}</span></span>
                      : <span className="text-muted-foreground">Sin cliente</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Badge variant="warning">
                      {minutesUntil(h.heldUntil)} min
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Today summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Confirmadas', value: data.today.bookings.confirmed, color: 'text-green-600' },
          { label: 'En espera', value: data.today.bookings.held, color: 'text-yellow-600' },
          { label: 'Completadas', value: data.today.bookings.completed, color: 'text-blue-600' },
          { label: 'Canceladas', value: data.today.bookings.cancelled, color: 'text-muted-foreground' },
          { label: 'No-show', value: data.today.bookings.noShow, color: 'text-destructive' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-background p-3 text-center space-y-0.5">
            <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

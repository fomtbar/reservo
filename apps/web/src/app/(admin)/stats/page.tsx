'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

// --- Types ---
type OccupancyData = {
  from: string;
  to: string;
  totalCourts: number;
  dowCounts: Record<number, number>;
  heatmap: { dow: number; hour: number; bookings: number; maxPossible: number; pct: number }[];
};

type LtvCustomer = {
  id: string;
  name: string;
  phone: string;
  totalBookings: number;
  totalSpent: number;
  avgTicket: number;
  firstBooking: string;
  lastBooking: string;
};

// --- Constants ---
const DOW_LABEL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 07:00 – 21:00

const PRESETS = [
  { label: 'Esta semana', getDates: () => { const now = new Date(); const dow = now.getDay(); const mon = new Date(now); mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1)); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); return { from: fmt(mon), to: fmt(sun) }; } },
  { label: 'Este mes', getDates: () => { const now = new Date(); return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }; } },
  { label: 'Últimos 30 días', getDates: () => { const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 29); return { from: fmt(from), to: fmt(to) }; } },
  { label: 'Últimos 90 días', getDates: () => { const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 89); return { from: fmt(from), to: fmt(to) }; } },
];

function fmt(d: Date) { return d.toLocaleDateString('sv-SE'); }

function pctToColor(pct: number) {
  if (pct === 0) return 'bg-gray-50 text-gray-300';
  if (pct <= 20) return 'bg-blue-50 text-blue-400';
  if (pct <= 40) return 'bg-blue-100 text-blue-500';
  if (pct <= 60) return 'bg-blue-200 text-blue-700';
  if (pct <= 80) return 'bg-blue-400 text-white';
  return 'bg-blue-600 text-white';
}

// --- Component ---
export default function StatsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [preset, setPreset] = useState(2);
  const [from, setFrom] = useState(() => PRESETS[2].getDates().from);
  const [to, setTo] = useState(() => PRESETS[2].getDates().to);

  const applyPreset = (i: number) => {
    const dates = PRESETS[i].getDates();
    setPreset(i);
    setFrom(dates.from);
    setTo(dates.to);
  };

  const { data: occupancy, isLoading: loadingOcc } = useQuery<OccupancyData>({
    queryKey: ['stats-occupancy', from, to],
    queryFn: () => apiFetch(`/stats/occupancy?from=${from}&to=${to}`, { token }),
    enabled: !!token,
  });

  const { data: ltv, isLoading: loadingLtv } = useQuery<LtvCustomer[]>({
    queryKey: ['stats-ltv'],
    queryFn: () => apiFetch('/stats/customers/ltv?limit=50', { token }),
    enabled: !!token,
  });

  // Build heatmap lookup: dow × hour → pct
  const heatLookup = new Map<string, { pct: number; bookings: number; maxPossible: number }>();
  occupancy?.heatmap.forEach((r) => heatLookup.set(`${r.dow}:${r.hour}`, r));

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });

  return (
    <div className="p-6 space-y-8 max-w-6xl">
      <h1 className="text-xl font-semibold">Estadísticas</h1>

      {/* Date range */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => applyPreset(i)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                preset === i
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset(-1); }}
            className="border rounded-md px-2 py-1.5 text-sm bg-background" />
          <span className="text-muted-foreground">→</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset(-1); }}
            className="border rounded-md px-2 py-1.5 text-sm bg-background" />
        </div>
      </div>

      {/* Occupancy heatmap */}
      <section>
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-base font-semibold">Heatmap de ocupación</h2>
          {occupancy && (
            <span className="text-xs text-muted-foreground">
              {occupancy.totalCourts} canche{occupancy.totalCourts !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {loadingOcc ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="w-12 text-right pr-2 text-muted-foreground font-normal"></th>
                  {DOW_LABEL.map((d, i) => (
                    <th key={i} className="w-16 text-center pb-1 font-medium text-muted-foreground">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour}>
                    <td className="text-right pr-2 py-0.5 text-muted-foreground tabular-nums">
                      {String(hour).padStart(2, '0')}:00
                    </td>
                    {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
                      const cell = heatLookup.get(`${dow}:${hour}`);
                      const pct = cell?.pct ?? 0;
                      const title = cell
                        ? `${DOW_LABEL[dow]} ${hour}:00 — ${cell.bookings} reservas / ${cell.maxPossible} posibles (${pct}%)`
                        : `${DOW_LABEL[dow]} ${hour}:00 — sin datos`;
                      return (
                        <td key={dow} className="p-0.5" title={title}>
                          <div className={`w-14 h-8 rounded flex items-center justify-center font-semibold transition-colors ${pctToColor(pct)}`}>
                            {pct > 0 ? `${pct}%` : ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <span>Ocupación:</span>
              {[
                { label: '0%', cls: 'bg-gray-50 border border-gray-200' },
                { label: '1–20%', cls: 'bg-blue-50' },
                { label: '21–40%', cls: 'bg-blue-100' },
                { label: '41–60%', cls: 'bg-blue-200' },
                { label: '61–80%', cls: 'bg-blue-400' },
                { label: '81–100%', cls: 'bg-blue-600' },
              ].map(({ label, cls }) => (
                <span key={label} className="flex items-center gap-1">
                  <span className={`inline-block w-4 h-4 rounded ${cls}`} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* LTV table */}
      <section>
        <h2 className="text-base font-semibold mb-3">Top clientes por facturación</h2>

        {loadingLtv ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : !ltv?.length ? (
          <div className="text-sm text-muted-foreground">Sin datos de clientes todavía.</div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Teléfono</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Reservas</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total pagado</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Ticket prom.</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Primera</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Última</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ltv.map((c, i) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium">{c.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{c.phone}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{c.totalBookings}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{formatCurrency(String(c.totalSpent))}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatCurrency(String(c.avgTicket))}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{fmtDate(c.firstBooking)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{fmtDate(c.lastBooking)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type RevenueDay = { date: string; totals: Record<string, number>; total: number };
type RevenueReport = {
  from: string; to: string;
  days: RevenueDay[];
  methodTotals: Record<string, number>;
  grandTotal: number;
};

type BookingReport = Array<{
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  price: string;
  paidAmount: string;
  paymentStatus: string;
  source: string;
  notes: string | null;
  court: { name: string };
  customer: { name: string; phone: string } | null;
}>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', MERCADOPAGO: 'MercadoPago',
};
const STATUS_LABEL: Record<string, string> = {
  HELD: 'En espera', CONFIRMED: 'Confirmada', COMPLETED: 'Completada',
  CANCELLED: 'Cancelada', NO_SHOW: 'No-show',
};
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CONFIRMED: 'default', COMPLETED: 'secondary', HELD: 'outline',
  CANCELLED: 'outline', NO_SHOW: 'destructive',
};
const METHODS = ['CASH', 'CARD', 'TRANSFER', 'MERCADOPAGO'];

function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function presets() {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);

  return [
    { label: 'Esta semana', from: toDateStr(weekStart), to: toDateStr(today) },
    { label: 'Este mes', from: toDateStr(startOfMonth(today)), to: toDateStr(today) },
    { label: 'Mes anterior', from: toDateStr(prevMonthStart), to: toDateStr(prevMonthEnd) },
    { label: 'Últimos 30 días', from: toDateStr(new Date(today.getTime() - 29 * 86400000)), to: toDateStr(today) },
  ];
}

function exportRevenueCsv(report: RevenueReport) {
  const methods = METHODS.filter((m) => report.methodTotals[m] !== undefined);
  const header = ['Fecha', ...methods.map((m) => METHOD_LABEL[m]), 'Total'];
  const rows = report.days.map((d) => [
    d.date,
    ...methods.map((m) => String(d.totals[m] ?? 0)),
    String(d.total),
  ]);
  rows.push(['TOTAL', ...methods.map((m) => String(report.methodTotals[m] ?? 0)), String(report.grandTotal)]);
  downloadCsv([header, ...rows], `ingresos-${report.from}-${report.to}.csv`);
}

function exportBookingsCsv(bookings: BookingReport, from: string, to: string) {
  const header = ['Fecha', 'Hora inicio', 'Hora fin', 'Cancha', 'Cliente', 'Teléfono', 'Estado', 'Precio', 'Pagado', 'Fuente'];
  const rows = bookings.map((b) => [
    b.startsAt.slice(0, 10),
    formatDate(b.startsAt, { hour: '2-digit', minute: '2-digit', hour12: false }),
    formatDate(b.endsAt, { hour: '2-digit', minute: '2-digit', hour12: false }),
    b.court.name,
    b.customer?.name ?? '',
    b.customer?.phone ?? '',
    STATUS_LABEL[b.status] ?? b.status,
    b.price,
    b.paidAmount,
    b.source,
  ]);
  downloadCsv([header, ...rows], `reservas-${from}-${to}.csv`);
}

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ReportType = 'reservas' | 'ingresos';

export default function ReportsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const today = toDateStr(new Date());
  const monthStart = toDateStr(startOfMonth(new Date()));

  const [type, setType] = useState<ReportType>('ingresos');
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  const revenueQuery = useQuery<RevenueReport>({
    queryKey: ['report-revenue', from, to],
    queryFn: () => apiFetch(`/reports/revenue?from=${from}&to=${to}`, { token }),
    enabled: !!token && type === 'ingresos',
  });

  const bookingsQuery = useQuery<BookingReport>({
    queryKey: ['report-bookings', from, to],
    queryFn: () => apiFetch(`/bookings?from=${from}T00:00:00Z&to=${to}T23:59:59Z`, { token }),
    enabled: !!token && type === 'reservas',
  });

  function applyPreset(p: { from: string; to: string }) {
    setFrom(p.from);
    setTo(p.to);
  }

  const isLoading = type === 'ingresos' ? revenueQuery.isLoading : bookingsQuery.isLoading;

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-xl font-semibold">Reportes</h1>

      {/* Controls */}
      <div className="rounded-xl border bg-background p-4 space-y-4 print:hidden">
        {/* Type selector */}
        <div className="flex gap-2">
          {(['ingresos', 'reservas'] as ReportType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                type === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'ingresos' ? 'Ingresos' : 'Reservas'}
            </button>
          ))}
        </div>

        {/* Date range + presets */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">De</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Hasta</label>
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets().map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className="px-3 py-1 rounded-md text-xs border hover:bg-muted transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isLoading}
            onClick={() => {
              if (type === 'ingresos' && revenueQuery.data) exportRevenueCsv(revenueQuery.data);
              if (type === 'reservas' && bookingsQuery.data) exportBookingsCsv(bookingsQuery.data, from, to);
            }}
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Print header (only visible when printing) */}
      <div className="hidden print:block space-y-1 pb-4 border-b">
        <h2 className="text-lg font-bold">
          {type === 'ingresos' ? 'Reporte de Ingresos' : 'Reporte de Reservas'}
        </h2>
        <p className="text-sm text-muted-foreground">Período: {from} al {to}</p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>
      ) : type === 'ingresos' ? (
        <RevenueTable report={revenueQuery.data} />
      ) : (
        <BookingsTable bookings={bookingsQuery.data ?? []} />
      )}
    </div>
  );
}

// ─── Revenue table ────────────────────────────────────────────────────────────

function RevenueTable({ report }: { report?: RevenueReport }) {
  if (!report) return null;
  const methods = METHODS.filter((m) => (report.methodTotals[m] ?? 0) > 0);

  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
        {methods.map((m) => (
          <div key={m} className="bg-background p-4 space-y-0.5">
            <p className="text-xs text-muted-foreground">{METHOD_LABEL[m]}</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatCurrency(String(report.methodTotals[m] ?? 0))}
            </p>
          </div>
        ))}
        {methods.length === 0 && (
          <div className="bg-background p-4 col-span-4 text-center text-sm text-muted-foreground">
            Sin ingresos en el período
          </div>
        )}
      </div>

      {/* Grand total */}
      <div className="px-5 py-3 border-b flex items-center justify-between bg-muted/20">
        <span className="text-sm font-medium">Total del período</span>
        <span className="text-xl font-bold tabular-nums">{formatCurrency(String(report.grandTotal))}</span>
      </div>

      {/* Daily breakdown */}
      {report.days.some((d) => d.total > 0) && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Fecha</th>
              {methods.map((m) => (
                <th key={m} className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  {METHOD_LABEL[m]}
                </th>
              ))}
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {report.days.filter((d) => d.total > 0).map((d) => (
              <tr key={d.date} className="hover:bg-muted/20">
                <td className="px-4 py-2.5 tabular-nums">
                  {formatDate(d.date + 'T12:00:00Z', { weekday: 'short', day: 'numeric', month: 'short' })}
                </td>
                {methods.map((m) => (
                  <td key={m} className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {d.totals[m] ? formatCurrency(String(d.totals[m])) : '—'}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                  {formatCurrency(String(d.total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Bookings table ───────────────────────────────────────────────────────────

function BookingsTable({ bookings }: { bookings: BookingReport }) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-xl border bg-background py-16 text-center text-sm text-muted-foreground">
        Sin reservas en el período
      </div>
    );
  }

  const totalRevenue = bookings.reduce((s, b) => s + Number(b.paidAmount), 0);

  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      {/* Summary */}
      <div className="px-5 py-3 border-b bg-muted/20 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{bookings.length} reservas</span>
        <span className="text-sm font-medium">
          Cobrado: <span className="font-bold tabular-nums">{formatCurrency(String(totalRevenue))}</span>
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Fecha</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Horario</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Cancha</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Cliente</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Estado</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Precio</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Pagado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {bookings.map((b) => (
              <tr key={b.id} className="hover:bg-muted/20">
                <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                  {formatDate(b.startsAt, { day: '2-digit', month: '2-digit' })}
                </td>
                <td className="px-4 py-2.5 tabular-nums">
                  {formatDate(b.startsAt, { hour: '2-digit', minute: '2-digit', hour12: false })}
                  {' – '}
                  {formatDate(b.endsAt, { hour: '2-digit', minute: '2-digit', hour12: false })}
                </td>
                <td className="px-4 py-2.5">{b.court.name}</td>
                <td className="px-4 py-2.5">
                  {b.customer
                    ? <span>{b.customer.name} <span className="text-xs text-muted-foreground">{b.customer.phone}</span></span>
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={STATUS_VARIANT[b.status] ?? 'outline'} className="text-xs">
                    {STATUS_LABEL[b.status] ?? b.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(b.price)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatCurrency(b.paidAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

type CashPayment = {
  id: string;
  amount: string;
  method: string;
  createdAt: string;
  booking: {
    id: string;
    startsAt: string;
    court: { name: string };
    customer: { name: string } | null;
  };
};

type CashSummary = {
  date: string;
  payments: CashPayment[];
  totals: Record<string, number>;
  grandTotal: number;
};

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  MERCADOPAGO: 'MercadoPago',
};

const METHOD_ICON: Record<string, string> = {
  CASH: '💵',
  CARD: '💳',
  TRANSFER: '🏦',
  MERCADOPAGO: '🔵',
};

const ALL_METHODS = ['CASH', 'CARD', 'TRANSFER', 'MERCADOPAGO'];

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function exportCsv(payments: CashPayment[], dateStr: string) {
  const rows = [
    ['Hora', 'Cancha', 'Cliente', 'Método', 'Monto'],
    ...payments.map((p) => [
      new Date(p.booking.startsAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }),
      p.booking.court.name,
      p.booking.customer?.name ?? '',
      METHOD_LABEL[p.method] ?? p.method,
      p.amount,
    ]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `caja-${dateStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CajaPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const [date, setDate] = useState(() => new Date());

  const dateStr = toDateStr(date);

  const { data, isLoading } = useQuery<CashSummary>({
    queryKey: ['cash-register', dateStr],
    queryFn: () => apiFetch(`/cash-register?date=${dateStr}`, { token }),
    enabled: !!token,
  });

  const isToday = dateStr === toDateStr(new Date());

  const dateLabel = formatDate(date.toISOString(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Caja diaria</h1>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">{dateLabel}</p>
        </div>
        {data && data.payments.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => exportCsv(data.payments, dateStr)}>
            <Download className="h-4 w-4 mr-1.5" />
            Exportar CSV
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>
          Hoy
        </Button>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="sm" className="px-1.5" onClick={() => setDate((d) => addDays(d, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => { if (e.target.value) setDate(new Date(e.target.value + 'T12:00:00Z')); }}
            className="h-8 rounded-md border bg-background px-2 text-sm focus-visible:outline-none"
          />
          <Button variant="ghost" size="sm" className="px-1.5" onClick={() => setDate((d) => addDays(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>
      ) : (
        <>
          {/* Totals by method */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ALL_METHODS.map((method) => {
              const amount = data?.totals[method] ?? 0;
              return (
                <div key={method} className="rounded-xl border bg-background p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {METHOD_ICON[method]} {METHOD_LABEL[method]}
                  </p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatCurrency(String(amount))}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Grand total */}
          <div className="rounded-xl border bg-background p-4 flex items-center justify-between">
            <p className="text-sm font-medium">Total del día</p>
            <p className="text-2xl font-bold tabular-nums">
              {formatCurrency(String(data?.grandTotal ?? 0))}
            </p>
          </div>

          {/* Payment list */}
          {data && data.payments.length > 0 ? (
            <div className="rounded-xl border bg-background overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Hora</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Cancha</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Método</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                        {formatDate(p.booking.startsAt, { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </td>
                      <td className="px-4 py-2.5">{p.booking.court.name}</td>
                      <td className="px-4 py-2.5">
                        {p.booking.customer?.name ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {METHOD_ICON[p.method]} {METHOD_LABEL[p.method] ?? p.method}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border bg-background py-16 text-center text-sm text-muted-foreground">
              {isToday ? 'Sin cobros registrados hoy' : 'Sin cobros en esta fecha'}
            </div>
          )}
        </>
      )}
    </div>
  );
}

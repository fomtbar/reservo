'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { Bell, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type WaitlistEntry = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  startsAt: string;
  endsAt: string;
  notified: boolean;
  notifiedAt: string | null;
  createdAt: string;
  court: { id: string; name: string; color: string };
};

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export default function WaitlistPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date());

  const dateStr = toDateStr(date);

  const { data: entries = [], isLoading } = useQuery<WaitlistEntry[]>({
    queryKey: ['waitlist', dateStr],
    queryFn: () => apiFetch(`/waitlist?date=${dateStr}`, { token }),
    enabled: !!token,
  });

  const notify = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/waitlist/${id}/notify`, { method: 'POST', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['waitlist'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/waitlist/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['waitlist'] }),
  });

  const dateLabel = date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const pending = entries.filter((e) => !e.notified);
  const notified = entries.filter((e) => e.notified);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Lista de espera</h1>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">{dateLabel}</p>
        </div>
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
      ) : entries.length === 0 ? (
        <div className="rounded-xl border bg-background py-16 text-center text-sm text-muted-foreground">
          Sin entradas en lista de espera para este día
        </div>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div className="rounded-xl border bg-background overflow-hidden">
              <div className="px-4 py-2.5 border-b bg-muted/40 flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Pendientes ({pending.length})
                </span>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {pending.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      onNotify={() => notify.mutate(entry.id)}
                      onRemove={() => remove.mutate(entry.id)}
                      notifying={notify.isPending && notify.variables === entry.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {notified.length > 0 && (
            <div className="rounded-xl border bg-background overflow-hidden opacity-60">
              <div className="px-4 py-2.5 border-b bg-muted/40">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Notificados ({notified.length})
                </span>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {notified.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      onRemove={() => remove.mutate(entry.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EntryRow({
  entry,
  onNotify,
  onRemove,
  notifying,
}: {
  entry: WaitlistEntry;
  onNotify?: () => void;
  onRemove: () => void;
  notifying?: boolean;
}) {
  const timeStr = formatDate(entry.startsAt, { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.court.color ?? '#3b82f6' }}
          />
          <span className="font-medium">{entry.court.name}</span>
          <span className="text-muted-foreground text-xs">{timeStr}</span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <span className="font-medium">{entry.name}</span>
        <span className="text-muted-foreground text-xs ml-2">{entry.phone}</span>
      </td>
      <td className="px-4 py-2.5">
        {entry.notified ? (
          <Badge variant="secondary">
            Notificado {entry.notifiedAt ? formatDate(entry.notifiedAt, { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">
            Anotado {formatDate(entry.createdAt, { hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          {onNotify && !entry.notified && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNotify}
              disabled={notifying}
              className="h-7 text-xs gap-1"
            >
              <Bell className="h-3 w-3" />
              {notifying ? '…' : 'Notificar'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

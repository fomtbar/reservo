'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BookingDetail, type BookingEvent } from '@/components/agenda/booking-detail';
import { BookingForm } from '@/components/agenda/booking-form';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const FullCalendarView = dynamic(
  () => import('@/components/agenda/fullcalendar-view'),
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Cargando agenda…</div> },
);

type Court = { id: string; name: string; color: string; active: boolean; branchId: string | null };
type Branch = { id: string; name: string };

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export default function AgendaPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [date, setDate] = useState(() => startOfDay(new Date()));
  const [form, setForm] = useState<{ courtId: string; courtName: string; start: Date; end: Date } | null>(null);
  const [detail, setDetail] = useState<BookingEvent | null>(null);
  const [branchFilter, setBranchFilter] = useState<string>('');

  const { data: courts = [] } = useQuery<Court[]>({
    queryKey: ['courts'],
    queryFn: () => apiFetch('/courts', { token }),
    enabled: !!token,
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => apiFetch('/branches', { token }),
    enabled: !!token,
  });

  const activeCourts = courts.filter((c) => {
    if (!c.active) return false;
    if (branchFilter && c.branchId !== branchFilter) return false;
    return true;
  });

  const from = toDateStr(date);
  const to = toDateStr(addDays(date, 1));

  const { data: bookings = [] } = useQuery<BookingEvent[]>({
    queryKey: ['bookings', from],
    queryFn: () =>
      apiFetch(`/bookings?from=${from}&to=${to}&status=HELD,CONFIRMED,COMPLETED,NO_SHOW`, { token }),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const isToday = toDateStr(date) === toDateStr(new Date());

  const dateLabel = formatDate(date.toISOString(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 pb-4 shrink-0">
        <Button variant="outline" size="sm" onClick={() => setDate(startOfDay(new Date()))}>
          Hoy
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="px-1.5" onClick={() => setDate((d) => addDays(d, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="px-1.5" onClick={() => setDate((d) => addDays(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-sm font-medium capitalize">
          {dateLabel}
          {isToday && <span className="ml-2 text-xs text-primary font-semibold">HOY</span>}
        </h2>

        {branches.length > 0 && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="ml-auto flex h-8 rounded-md border bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <option value="">Todas las sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Calendar */}
      <div className="flex-1 min-h-0">
        <FullCalendarView
          courts={activeCourts}
          bookings={bookings}
          date={date}
          onSlotClick={(courtId, courtName, start, end) =>
            setForm({ courtId, courtName, start, end })
          }
          onBookingClick={(b) => setDetail(b)}
        />
      </div>

      {/* Modals */}
      {form && (
        <BookingForm
          open
          onClose={() => setForm(null)}
          courtId={form.courtId}
          courtName={form.courtName}
          initialStart={form.start.toISOString()}
          initialEnd={form.end.toISOString()}
        />
      )}

      <BookingDetail booking={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

'use client';

import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, CreditCard, Building2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { AvailabilityGrid } from './availability-grid';
import { ReservationForm } from './reservation-form';
import { WaitlistForm } from './waitlist-form';
import Link from 'next/link';

type Court = { id: string; name: string; color: string; active: boolean; defaultSlotMinutes: number; branchId: string | null };
type OpeningHour = { id: string; courtId: string | null; dayOfWeek: number; opensAt: string; closesAt: string };
type TakenSlot = { id: string; startsAt: string; endsAt: string; status: string; courtId: string };
type PublicSettings = {
  businessName: string;
  allowWebBooking: boolean;
  requireDepositForWeb: boolean;
  mpEnabled: boolean;
  holdMinutes: number;
  currency: string;
};

function toDateStr(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const isSandbox = process.env.NEXT_PUBLIC_MP_SANDBOX === 'true';

type Branch = { id: string; name: string };

function ReservaPageContent() {
  const searchParams = useSearchParams();
  const branchFilter = searchParams.get('branch') ?? '';

  const [date, setDate] = useState(() => new Date());
  const [selectedSlot, setSelectedSlot] = useState<{
    courtId: string; courtName: string; start: Date; end: Date;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedWaitlist, setConfirmedWaitlist] = useState(false);
  const [waitlistSlot, setWaitlistSlot] = useState<{ courtId: string; courtName: string; start: Date; end: Date } | null>(null);
  const [redirectingToMp, setRedirectingToMp] = useState(false);

  const dateStr = toDateStr(date);
  const dayOfWeek = date.getDay();
  const todayStr = toDateStr(new Date());

  const { data: courts = [] } = useQuery<Court[]>({
    queryKey: ['courts-public'],
    queryFn: () => apiFetch('/courts'),
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches-public'],
    queryFn: () => apiFetch('/branches'),
  });

  const { data: hours = [] } = useQuery<OpeningHour[]>({
    queryKey: ['opening-hours-public'],
    queryFn: () => apiFetch('/opening-hours'),
  });

  const { data: bookings = [] } = useQuery<TakenSlot[]>({
    queryKey: ['bookings-availability', dateStr],
    queryFn: () => apiFetch(`/bookings/availability?date=${dateStr}`),
  });

  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ['settings-public'],
    queryFn: () => apiFetch('/settings/public'),
  });

  const createReservation = useMutation({
    mutationFn: async (data: {
      courtId: string;
      startsAt: string;
      endsAt: string;
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      promoCode?: string;
    }) => {
      const booking = await apiFetch<{ id: string }>('/bookings/hold', { method: 'POST', body: data });

      if (settings?.requireDepositForWeb && settings.mpEnabled) {
        setRedirectingToMp(true);
        try {
          const checkout = await apiFetch<{ initPoint: string; sandboxInitPoint: string }>(`/bookings/${booking.id}/mp-checkout`, {
            method: 'POST',
            body: { returnBaseUrl: window.location.origin },
          });
          const url = isSandbox ? checkout.sandboxInitPoint : checkout.initPoint;
          window.location.href = url;
        } catch {
          // MP checkout failed — still show confirmation (booking held, staff will confirm)
          setRedirectingToMp(false);
          setConfirmed(true);
        }
        return booking;
      }

      setConfirmed(true);
      return booking;
    },
  });

  const joinWaitlist = useMutation({
    mutationFn: (data: { name: string; phone: string; email?: string }) =>
      apiFetch('/waitlist', {
        method: 'POST',
        body: {
          courtId: waitlistSlot!.courtId,
          startsAt: waitlistSlot!.start.toISOString(),
          endsAt: waitlistSlot!.end.toISOString(),
          ...data,
        },
      }),
    onSuccess: () => {
      setWaitlistSlot(null);
      setConfirmedWaitlist(true);
    },
  });

  const activeCourts = courts.filter((c) => {
    if (!c.active) return false;
    if (branchFilter && c.branchId !== branchFilter) return false;
    return true;
  });

  const filteredBranch = branchFilter
    ? branches.find((b) => b.id === branchFilter) ?? null
    : null;

  if (redirectingToMp) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-24 text-center space-y-4">
        <CreditCard className="h-12 w-12 mx-auto text-primary animate-pulse" />
        <p className="text-lg font-medium">Redirigiendo a Mercado Pago…</p>
        <p className="text-sm text-muted-foreground">No cerrés esta ventana.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Reservar cancha</h1>
        <p className="text-muted-foreground">
          Seleccioná la cancha y el horario que prefieras.
        </p>
      </div>

      {/* Branch filter banner */}
      {filteredBranch && (
        <div className="flex items-center gap-2 rounded-lg border bg-primary/5 border-primary/20 px-4 py-2.5 text-sm">
          <Building2 className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-primary">Sede: {filteredBranch.name}</span>
          <Link
            href="/reservar"
            className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            <span className="text-xs">Ver todas</span>
          </Link>
        </div>
      )}

      {/* Date picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium">Fecha:</label>
        <input
          type="date"
          value={dateStr}
          onChange={(e) => setDate(new Date(e.target.value + 'T12:00:00Z'))}
          min={todayStr}
          className="h-10 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDate(new Date())}
          disabled={dateStr === todayStr}
        >
          Hoy
        </Button>
        {dateStr === todayStr && <span className="text-xs text-primary font-semibold">HOY</span>}
      </div>

      {/* Availability grid */}
      <AvailabilityGrid
        date={date}
        dayOfWeek={dayOfWeek}
        courts={activeCourts}
        hours={hours}
        bookings={bookings}
        onSelectSlot={(courtId, courtName, start, end) => {
          setSelectedSlot({ courtId, courtName, start, end });
          setConfirmed(false);
          setConfirmedWaitlist(false);
        }}
        onJoinWaitlist={(info) => {
          setWaitlistSlot(info);
          setConfirmed(false);
          setConfirmedWaitlist(false);
        }}
      />

      {/* Reservation form modal */}
      {selectedSlot && (
        <ReservationForm
          slot={selectedSlot}
          onCancel={() => setSelectedSlot(null)}
          onSuccess={() => {}}
          onSubmit={(data) =>
            createReservation.mutate({
              courtId: selectedSlot.courtId,
              startsAt: selectedSlot.start.toISOString(),
              endsAt: selectedSlot.end.toISOString(),
              ...data,
            })
          }
          isLoading={createReservation.isPending}
          error={createReservation.error}
        />
      )}

      {/* Waitlist form modal */}
      {waitlistSlot && (
        <WaitlistForm
          slot={waitlistSlot}
          onCancel={() => setWaitlistSlot(null)}
          onSubmit={(data) => joinWaitlist.mutate(data)}
          isLoading={joinWaitlist.isPending}
          error={joinWaitlist.error}
        />
      )}

      {/* Waitlist confirmation */}
      {confirmedWaitlist && (
        <div className="rounded-lg border bg-blue-50 border-blue-200 p-6 space-y-3">
          <div className="flex items-start gap-3">
            <Check className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h3 className="font-semibold text-blue-900">¡Anotado en lista de espera!</h3>
              <p className="text-sm text-blue-800">
                Te avisamos en cuanto se libere el turno.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation */}
      {confirmed && (
        <div className="rounded-lg border bg-green-50 border-green-200 p-6 space-y-3">
          <div className="flex items-start gap-3">
            <Check className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h3 className="font-semibold text-green-900">¡Pre-reserva recibida!</h3>
              <p className="text-sm text-green-800">
                Gracias por tu reserva. Nos comunicaremos en los próximos minutos para confirmar.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const reservaQueryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 }, mutations: { retry: 0 } },
});

export default function ReservaPage() {
  return (
    <QueryClientProvider client={reservaQueryClient}>
      <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-12 text-sm text-muted-foreground">Cargando…</div>}>
        <ReservaPageContent />
      </Suspense>
    </QueryClientProvider>
  );
}

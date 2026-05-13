'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type PublicBooking = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  court: { name: string; sport: string };
  customer: { name: string } | null;
};

const STATUS_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  CONFIRMED: { icon: '✓', label: 'Confirmada', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  COMPLETED: { icon: '✓', label: 'Completada', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  HELD:      { icon: '⏳', label: 'En espera', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  CANCELLED: { icon: '✕', label: 'Cancelada', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  NO_SHOW:   { icon: '✕', label: 'No presentado', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
};

const SPORT_LABEL: Record<string, string> = {
  PADDLE: 'Paddle',
  TENNIS: 'Tenis',
  FOOTBALL: 'Fútbol',
  HOCKEY: 'Hockey',
};

export default function BookingValidationPage() {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api';
    fetch(`${apiBase}/bookings/${id}/public`)
      .then((r) => {
        if (!r.ok) throw new Error('Reserva no encontrada');
        return r.json() as Promise<PublicBooking>;
      })
      .then(setBooking)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Argentina/Buenos_Aires',
    });

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Argentina/Buenos_Aires',
    });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-muted-foreground text-sm">Verificando reserva…</div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">✕</div>
          <p className="text-red-700 font-semibold text-lg">Reserva no encontrada</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[booking.status] ?? { icon: '?', label: booking.status, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' };
  const isValid = booking.status === 'CONFIRMED' || booking.status === 'COMPLETED';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className={`rounded-2xl border-2 p-8 max-w-sm w-full text-center shadow-sm ${cfg.bg}`}>
        {/* Status icon */}
        <div className={`text-7xl font-bold mb-3 ${cfg.color}`}>{cfg.icon}</div>
        <p className={`text-2xl font-bold mb-6 ${cfg.color}`}>{cfg.label}</p>

        {/* Booking details */}
        <div className="text-left space-y-3 text-sm">
          <DetailRow label="Cancha">
            {booking.court.name}
            {booking.court.sport && (
              <span className="text-muted-foreground ml-1">
                · {SPORT_LABEL[booking.court.sport] ?? booking.court.sport}
              </span>
            )}
          </DetailRow>
          <DetailRow label="Fecha">{fmt(booking.startsAt)}</DetailRow>
          <DetailRow label="Horario">
            {fmtTime(booking.startsAt)} – {fmtTime(booking.endsAt)}
          </DetailRow>
          {booking.customer && (
            <DetailRow label="Cliente">{booking.customer.name}</DetailRow>
          )}
        </div>

        {/* Validity indicator */}
        <div className={`mt-6 rounded-xl py-3 px-4 ${isValid ? 'bg-green-100' : 'bg-red-100'}`}>
          <p className={`text-sm font-semibold ${isValid ? 'text-green-800' : 'text-red-800'}`}>
            {isValid ? 'Reserva válida para ingresar' : 'Reserva no habilitada para ingresar'}
          </p>
        </div>

        {/* Booking ID (for reference) */}
        <p className="mt-4 text-[10px] text-gray-400 break-all">ID: {booking.id}</p>
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 w-16 shrink-0">{label}</span>
      <span className="font-medium text-gray-800">{children}</span>
    </div>
  );
}

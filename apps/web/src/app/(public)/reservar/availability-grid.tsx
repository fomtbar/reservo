'use client';

import { Button } from '@/components/ui/button';

type Court = { id: string; name: string; color: string; defaultSlotMinutes: number };
type OpeningHour = { id: string; courtId: string | null; dayOfWeek: number; opensAt: string; closesAt: string };
type TakenSlot = { id: string; startsAt: string; endsAt: string; status: string; courtId: string };

type SlotInfo = { courtId: string; courtName: string; start: Date; end: Date };

type Props = {
  date: Date;
  dayOfWeek: number;
  courts: Court[];
  hours: OpeningHour[];
  bookings: TakenSlot[];
  onSelectSlot: (courtId: string, courtName: string, start: Date, end: Date) => void;
  onJoinWaitlist: (info: SlotInfo) => void;
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function hasConflict(slotStart: Date, slotEnd: Date, bookings: TakenSlot[]): boolean {
  return bookings.some((b) => {
    const bStart = new Date(b.startsAt);
    const bEnd = new Date(b.endsAt);
    return slotStart < bEnd && slotEnd > bStart;
  });
}

export function AvailabilityGrid({
  date,
  dayOfWeek,
  courts,
  hours,
  bookings,
  onSelectSlot,
  onJoinWaitlist,
}: Props) {
  if (courts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No hay canchas disponibles
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {courts.map((court) => {
        const courtHour = hours.find(
          (h) => (h.courtId === court.id || h.courtId === null) && h.dayOfWeek === dayOfWeek
        );

        if (!courtHour) {
          return (
            <div key={court.id} className="space-y-3">
              <h3 className="font-semibold text-lg">{court.name}</h3>
              <p className="text-sm text-muted-foreground">Cerrada este día</p>
            </div>
          );
        }

        const openMins = timeToMinutes(courtHour.opensAt);
        const closeMins = timeToMinutes(courtHour.closesAt);
        const slotMins = court.defaultSlotMinutes;

        const slots: Array<{ start: number; end: number }> = [];
        for (let start = openMins; start + slotMins <= closeMins; start += slotMins) {
          slots.push({ start, end: start + slotMins });
        }

        const courtBookings = bookings.filter((b) => b.courtId === court.id);

        return (
          <div key={court.id} className="space-y-3">
            <h3 className="font-semibold text-lg">{court.name}</h3>
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => {
                const slotStart = new Date(date);
                slotStart.setHours(0, 0, 0, 0);
                slotStart.setMinutes(slotStart.getMinutes() + slot.start);

                const slotEnd = new Date(slotStart);
                slotEnd.setMinutes(slotEnd.getMinutes() + slotMins);

                const conflict = hasConflict(slotStart, slotEnd, courtBookings);
                const timeLabel = `${minutesToTime(slot.start)} – ${minutesToTime(slot.end)}`;
                const slotInfo: SlotInfo = { courtId: court.id, courtName: court.name, start: slotStart, end: slotEnd };

                if (conflict) {
                  return (
                    <div key={`${slot.start}`} className="flex flex-col items-center gap-0.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="opacity-40 cursor-not-allowed line-through text-xs"
                      >
                        {timeLabel}
                      </Button>
                      <button
                        onClick={() => onJoinWaitlist(slotInfo)}
                        className="text-[10px] text-primary hover:underline cursor-pointer leading-none"
                      >
                        Lista de espera
                      </button>
                    </div>
                  );
                }

                return (
                  <Button
                    key={`${slot.start}`}
                    variant="secondary"
                    size="sm"
                    onClick={() => onSelectSlot(court.id, court.name, slotStart, slotEnd)}
                  >
                    {timeLabel}
                  </Button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

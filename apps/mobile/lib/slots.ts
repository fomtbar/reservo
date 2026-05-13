import type { Court, OpeningHour, TakenSlot, SlotInfo } from './types';

// Generates time slots for all courts on a given date.
// Opening hours are treated as UTC (matching server behavior where bookings are stored as UTC).
export function buildCourtSlots(
  dateStr: string,
  courts: Court[],
  hours: OpeningHour[],
  taken: TakenSlot[],
): Array<{ court: Court; slots: SlotInfo[] }> {
  const dayOfWeek = new Date(dateStr + 'T12:00:00Z').getUTCDay();

  return courts
    .filter((c) => c.active)
    .map((court) => {
      // Court-specific hour takes priority over global (courtId === null)
      const hour =
        hours.find((h) => h.courtId === court.id && h.dayOfWeek === dayOfWeek) ??
        hours.find((h) => h.courtId === null && h.dayOfWeek === dayOfWeek);

      if (!hour) return { court, slots: [] };

      const slots = generateSlots(dateStr, hour.opensAt, hour.closesAt, court.defaultSlotMinutes ?? 60);
      const courtTaken = taken.filter((t) => t.courtId === court.id);

      return {
        court,
        slots: slots.map((s) => ({
          courtId: court.id,
          courtName: court.name,
          courtColor: court.color,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          available: !courtTaken.some(
            (t) =>
              new Date(t.startsAt) < s.endsAt && new Date(t.endsAt) > s.startsAt,
          ),
        })),
      };
    });
}

function generateSlots(
  dateStr: string,
  opensAt: string,
  closesAt: string,
  slotMinutes: number,
): Array<{ startsAt: Date; endsAt: Date }> {
  const [oh, om] = opensAt.split(':').map(Number);
  const [ch, cm] = closesAt.split(':').map(Number);
  const base = new Date(dateStr + 'T00:00:00Z');
  const openMs = (oh * 60 + om) * 60_000;
  const closeMs = (ch * 60 + cm) * 60_000;
  const stepMs = slotMinutes * 60_000;

  const result: Array<{ startsAt: Date; endsAt: Date }> = [];
  let cursor = openMs;
  while (cursor + stepMs <= closeMs) {
    result.push({
      startsAt: new Date(base.getTime() + cursor),
      endsAt: new Date(base.getTime() + cursor + stepMs),
    });
    cursor += stepMs;
  }
  return result;
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

export function toDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

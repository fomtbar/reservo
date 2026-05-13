'use client';

import FullCalendar from '@fullcalendar/react';
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useMemo } from 'react';
import type { BookingEvent } from './booking-detail';

type Court = { id: string; name: string; color: string };

type Props = {
  courts: Court[];
  bookings: BookingEvent[];
  date: Date;
  onSlotClick: (courtId: string, courtName: string, start: Date, end: Date) => void;
  onBookingClick: (booking: BookingEvent) => void;
};

const STATUS_COLOR: Record<string, string> = {
  HELD: '#f59e0b',
  CONFIRMED: '#22c55e',
  CANCELLED: '#6b7280',
  COMPLETED: '#3b82f6',
  NO_SHOW: '#ef4444',
};

export default function FullCalendarView({ courts, bookings, date, onSlotClick, onBookingClick }: Props) {
  const resources = useMemo(
    () => courts.map((c) => ({ id: c.id, title: c.name, eventColor: c.color || '#3b82f6' })),
    [courts],
  );

  const events = useMemo(
    () =>
      bookings.map((b) => ({
        id: b.id,
        resourceId: b.court.id,
        title: b.customer?.name ?? '(sin cliente)',
        start: b.startsAt,
        end: b.endsAt,
        backgroundColor: STATUS_COLOR[b.status] ?? '#3b82f6',
        borderColor: STATUS_COLOR[b.status] ?? '#3b82f6',
        extendedProps: { booking: b },
      })),
    [bookings],
  );

  return (
    <div className="fc-wrapper h-full text-sm">
      <FullCalendar
        schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
        plugins={[resourceTimeGridPlugin, interactionPlugin]}
        initialView="resourceTimeGridDay"
        initialDate={date}
        key={date.toISOString()}
        resources={resources}
        events={events}
        headerToolbar={false}
        allDaySlot={false}
        slotMinTime="07:00:00"
        slotMaxTime="24:00:00"
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        height="100%"
        locale="es"
        nowIndicator
        selectable
        selectMirror
        select={(info) => {
          const courtId = info.resource?.id;
          const courtName = info.resource?.title;
          if (courtId && courtName) {
            onSlotClick(courtId, courtName, info.start, info.end);
          }
          info.view.calendar.unselect();
        }}
        eventClick={(info) => {
          const booking = info.event.extendedProps.booking as BookingEvent;
          onBookingClick(booking);
        }}
        eventContent={(arg) => (
          <div className="px-1 py-0.5 overflow-hidden leading-tight">
            <div className="font-semibold truncate">{arg.event.title}</div>
            <div className="text-[10px] opacity-80">{arg.event.startStr.slice(11, 16)}</div>
          </div>
        )}
      />
    </div>
  );
}

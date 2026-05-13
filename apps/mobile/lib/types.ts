export type Court = {
  id: string;
  name: string;
  sport: string;
  color: string;
  active: boolean;
  defaultSlotMinutes: number;
};

export type OpeningHour = {
  id: string;
  courtId: string | null;
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
};

export type TakenSlot = {
  id: string;
  courtId: string;
  startsAt: string;
  endsAt: string;
  status: string;
};

export type SlotInfo = {
  courtId: string;
  courtName: string;
  courtColor: string;
  startsAt: Date;
  endsAt: Date;
  available: boolean;
};

export type CustomerBooking = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  paymentStatus: string;
  heldUntil: string | null;
  court: { name: string; sport: string };
};

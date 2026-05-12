export type BookingStatus = 'HELD' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
export type BookingSource = 'WALK_IN' | 'PHONE' | 'WEB';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'MERCADOPAGO';

export interface BookingSlot {
  courtId: string;
  startsAt: string;
  endsAt: string;
  available: boolean;
  price?: number;
}

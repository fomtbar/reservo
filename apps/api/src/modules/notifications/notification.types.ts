export type NotificationJobData = {
  bookingId: string;
  type: 'confirmation' | 'reminder-24h' | 'reminder-2h';
  customerName: string;
  customerPhone: string;
  courtName: string;
  startsAt: string;
  businessName: string;
};

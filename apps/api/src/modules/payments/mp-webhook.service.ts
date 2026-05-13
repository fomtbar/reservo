import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MpWebhookService {
  private readonly logger = new Logger(MpWebhookService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async processPayment(mpPaymentId: string) {
    const existing = await this.prisma.payment.findFirst({
      where: { externalId: mpPaymentId, method: 'MERCADOPAGO' },
    });
    if (existing) {
      this.logger.log(`MP payment ${mpPaymentId} already processed`);
      return;
    }

    const settings = await this.prisma.tenantSettings.findUnique({ where: { id: 1 } });
    if (!settings?.mpAccessToken) return;

    const mp = new MercadoPagoConfig({ accessToken: settings.mpAccessToken });
    const paymentClient = new Payment(mp);

    let mpPayment: Awaited<ReturnType<typeof paymentClient.get>>;
    try {
      mpPayment = await paymentClient.get({ id: mpPaymentId });
    } catch (err) {
      this.logger.error(`Failed to fetch MP payment ${mpPaymentId}`, err);
      return;
    }

    if (mpPayment.status !== 'approved') {
      this.logger.log(`MP payment ${mpPaymentId} has status "${mpPayment.status}", skipping`);
      return;
    }

    const bookingId = mpPayment.external_reference;
    if (!bookingId) return;

    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.status === 'CANCELLED') {
      this.logger.warn(`Booking ${bookingId} not found or cancelled`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          bookingId,
          amount: new Prisma.Decimal(mpPayment.transaction_amount ?? 0),
          method: 'MERCADOPAGO',
          externalId: String(mpPaymentId),
          status: 'completed',
          raw: mpPayment as object,
        },
      });

      const agg = await tx.payment.aggregate({
        where: { bookingId },
        _sum: { amount: true },
      });

      const paidAmount = agg._sum.amount ?? new Prisma.Decimal(0);
      const paymentStatus = paidAmount.gte(booking.price) ? 'PAID' : 'PARTIAL';

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: booking.status === 'HELD' ? 'CONFIRMED' : booking.status,
          paidAmount,
          paymentStatus,
        },
      });
    });

    this.logger.log(`MP payment ${mpPaymentId} processed → booking ${bookingId} confirmed`);
    this.notifications.scheduleBookingNotifications(bookingId).catch(() => void 0);
  }
}

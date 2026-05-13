import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { NOTIFICATION_QUEUE } from './notification.processor';
import { NotificationJobData } from './notification.types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue(NOTIFICATION_QUEUE) private queue: Queue<NotificationJobData>,
    private prisma: PrismaService,
  ) {}

  async scheduleBookingNotifications(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        court: { select: { name: true } },
        customer: { select: { name: true, phone: true } },
      },
    });

    if (!booking?.customer) {
      this.logger.debug(`Booking ${bookingId} has no customer, skipping notifications`);
      return;
    }

    const settings = await this.prisma.tenantSettings.findUnique({ where: { id: 1 } });
    const businessName = settings?.businessName ?? 'El local';

    const base: Omit<NotificationJobData, 'type'> = {
      bookingId,
      customerName: booking.customer.name,
      customerPhone: booking.customer.phone,
      courtName: booking.court.name,
      startsAt: booking.startsAt.toISOString(),
      businessName,
    };

    const now = Date.now();
    const startsAt = booking.startsAt.getTime();

    // Immediate confirmation
    await this.queue.add('notify', { ...base, type: 'confirmation' }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    // T-24h reminder
    const t24h = startsAt - 24 * 60 * 60 * 1000;
    if (t24h > now + 60_000) {
      await this.queue.add('notify', { ...base, type: 'reminder-24h' }, {
        delay: t24h - now,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        jobId: `reminder-24h-${bookingId}`,
      });
    }

    // T-2h reminder
    const t2h = startsAt - 2 * 60 * 60 * 1000;
    if (t2h > now + 60_000) {
      await this.queue.add('notify', { ...base, type: 'reminder-2h' }, {
        delay: t2h - now,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        jobId: `reminder-2h-${bookingId}`,
      });
    }

    this.logger.log(`Notifications scheduled for booking ${bookingId}`);
  }

  async cancelBookingNotifications(bookingId: string): Promise<void> {
    const job24h = await this.queue.getJob(`reminder-24h-${bookingId}`);
    const job2h = await this.queue.getJob(`reminder-2h-${bookingId}`);
    await job24h?.remove();
    await job2h?.remove();
    this.logger.debug(`Removed reminder jobs for booking ${bookingId}`);
  }
}

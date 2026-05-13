import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationJobData } from './notification.types';
import { WhatsAppProvider } from './providers/whatsapp.provider';

export const NOTIFICATION_QUEUE = 'notifications';

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsAppProvider,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const data = job.data;
    this.logger.log(`Processing notification job: ${data.type} for booking ${data.bookingId}`);

    const settings = await this.prisma.tenantSettings.findUnique({ where: { id: 1 } });

    if (!settings?.whatsappEnabled) {
      this.logger.debug('WhatsApp disabled in settings, skipping');
      return;
    }

    // Skip reminders if booking is no longer active
    if (data.type !== 'confirmation') {
      const booking = await this.prisma.booking.findUnique({
        where: { id: data.bookingId },
        select: { status: true },
      });
      if (!booking || !['CONFIRMED'].includes(booking.status)) {
        this.logger.log(`Booking ${data.bookingId} is ${booking?.status}, skipping reminder`);
        return;
      }
    }

    await this.whatsapp.send(data);
  }
}

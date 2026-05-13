import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NOTIFICATION_QUEUE, NotificationProcessor } from './notification.processor';
import { NotificationsService } from './notifications.service';
import { WhatsAppProvider } from './providers/whatsapp.provider';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATION_QUEUE })],
  providers: [NotificationsService, NotificationProcessor, WhatsAppProvider],
  exports: [NotificationsService, WhatsAppProvider],
})
export class NotificationsModule {}

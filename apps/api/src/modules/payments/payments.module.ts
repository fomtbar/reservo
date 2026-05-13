import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { MpCheckoutService } from './mp-checkout.service';
import { MpWebhookController } from './mp-webhook.controller';
import { MpWebhookService } from './mp-webhook.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsController, MpWebhookController],
  providers: [PaymentsService, MpCheckoutService, MpWebhookService],
})
export class PaymentsModule {}

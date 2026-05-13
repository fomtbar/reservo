import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { MpWebhookService } from './mp-webhook.service';

@ApiExcludeController()
@Controller('webhooks')
export class MpWebhookController {
  private readonly logger = new Logger(MpWebhookController.name);

  constructor(private readonly service: MpWebhookService) {}

  @Post('mercadopago')
  @SkipAuth()
  @HttpCode(200)
  async handle(@Body() body: Record<string, unknown>) {
    const type = body['type'];
    const dataId = (body['data'] as Record<string, unknown> | undefined)?.['id'];
    this.logger.log(`MP webhook: type=${type} id=${dataId}`);

    if (type === 'payment' && dataId) {
      await this.service.processPayment(String(dataId));
    }

    return { received: true };
  }
}

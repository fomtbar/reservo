import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MpCheckoutService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async createPreference(bookingId: string, returnBaseUrl: string) {
    const [booking, settings] = await Promise.all([
      this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          court: { select: { name: true } },
          customer: { select: { name: true } },
        },
      }),
      this.prisma.tenantSettings.findUnique({ where: { id: 1 } }),
    ]);

    if (!booking) throw new NotFoundException('Reserva no encontrada');
    if (booking.status !== 'HELD') {
      throw new BadRequestException('La reserva no está en estado HELD');
    }
    if (!settings?.mpAccessToken) {
      throw new BadRequestException('Mercado Pago no está configurado');
    }

    const amount =
      Number(booking.deposit) > 0 ? Number(booking.deposit) : Number(booking.price);

    const apiUrl =
      this.config.get<string>('APP_API_URL') ?? 'http://localhost:4001';

    const mp = new MercadoPagoConfig({ accessToken: settings.mpAccessToken });
    const preference = new Preference(mp);

    const result = await preference.create({
      body: {
        items: [
          {
            id: bookingId,
            title: `Reserva ${booking.court.name}`,
            quantity: 1,
            unit_price: amount,
            currency_id: settings.currency ?? 'ARS',
          },
        ],
        payer: booking.customer ? { name: booking.customer.name } : undefined,
        external_reference: bookingId,
        back_urls: {
          success: `${returnBaseUrl}/reservar/exito`,
          failure: `${returnBaseUrl}/reservar/cancelado`,
          pending: `${returnBaseUrl}/reservar/pendiente`,
        },
        auto_return: 'approved',
        notification_url: `${apiUrl}/api/webhooks/mercadopago`,
      },
    });

    return {
      preferenceId: result.id,
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point,
    };
  }
}

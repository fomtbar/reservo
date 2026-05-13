import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationJobData } from '../notification.types';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Argentine numbers: add country code 54, and for local 15-style remove the 15
  if (digits.startsWith('54')) return digits;
  if (digits.startsWith('0')) return `54${digits.slice(1)}`;
  if (digits.length === 10) return `54${digits}`;
  return `54${digits}`;
}

@Injectable()
export class WhatsAppProvider {
  private readonly logger = new Logger(WhatsAppProvider.name);

  constructor(private config: ConfigService) {}

  async send(data: NotificationJobData): Promise<void> {
    const accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');

    if (!accessToken || !phoneNumberId) {
      this.logger.warn('WhatsApp not configured — skipping notification');
      return;
    }

    const to = normalizePhone(data.customerPhone);
    const { templateName, components } = this.buildTemplate(data);

    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'es_AR' },
        components,
      },
    };

    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`WhatsApp API error for ${to}: ${err}`);
    } else {
      this.logger.log(`WhatsApp ${data.type} sent to ${to}`);
    }
  }

  async sendWaitlistNotification(data: {
    name: string;
    phone: string;
    courtName: string;
    startsAt: string;
    businessName: string;
  }): Promise<void> {
    const accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    if (!accessToken || !phoneNumberId) return;

    const to = normalizePhone(data.phone);
    const dateStr = new Date(data.startsAt).toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: 'reservo_lista_espera',
        language: { code: 'es_AR' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: data.name },
              { type: 'text', text: data.courtName },
              { type: 'text', text: dateStr },
              { type: 'text', text: data.businessName },
            ],
          },
        ],
      },
    };

    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      this.logger.error(`WhatsApp waitlist error for ${to}: ${await res.text()}`);
    } else {
      this.logger.log(`WhatsApp waitlist notification sent to ${to}`);
    }
  }

  private buildTemplate(data: NotificationJobData) {
    const dateStr = new Date(data.startsAt).toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    if (data.type === 'confirmation') {
      return {
        templateName: 'reservo_confirmacion',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: data.customerName },
              { type: 'text', text: data.courtName },
              { type: 'text', text: dateStr },
              { type: 'text', text: data.businessName },
            ],
          },
        ],
      };
    }

    const horasAntes = data.type === 'reminder-24h' ? '24' : '2';
    return {
      templateName: 'reservo_recordatorio',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: data.customerName },
            { type: 'text', text: horasAntes },
            { type: 'text', text: data.courtName },
            { type: 'text', text: dateStr },
          ],
        },
      ],
    };
  }
}

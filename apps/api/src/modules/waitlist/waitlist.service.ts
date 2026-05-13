import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppProvider } from '../notifications/providers/whatsapp.provider';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';

@Injectable()
export class WaitlistService {
  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsAppProvider,
  ) {}

  async join(dto: JoinWaitlistDto) {
    return this.prisma.waitlistEntry.create({
      data: {
        courtId: dto.courtId,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        name: dto.name,
        phone: dto.phone,
        email: dto.email ?? null,
      },
    });
  }

  async findAll(filters: { date?: string; courtId?: string; notified?: string }) {
    const where: Record<string, unknown> = {};

    if (filters.courtId) where['courtId'] = filters.courtId;
    if (filters.notified !== undefined) where['notified'] = filters.notified === 'true';

    if (filters.date) {
      const from = new Date(filters.date + 'T00:00:00Z');
      const to = new Date(filters.date + 'T23:59:59Z');
      where['startsAt'] = { gte: from, lte: to };
    }

    return this.prisma.waitlistEntry.findMany({
      where,
      include: { court: { select: { id: true, name: true, color: true } } },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async remove(id: string) {
    const entry = await this.prisma.waitlistEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Entrada no encontrada');
    await this.prisma.waitlistEntry.delete({ where: { id } });
    return { deleted: true };
  }

  async notifyEntry(id: string) {
    const entry = await this.prisma.waitlistEntry.findUnique({
      where: { id },
      include: { court: { select: { name: true } } },
    });
    if (!entry) throw new NotFoundException('Entrada no encontrada');

    const settings = await this.prisma.tenantSettings.findUnique({ where: { id: 1 } });

    if (settings?.whatsappEnabled) {
      await this.whatsapp.sendWaitlistNotification({
        name: entry.name,
        phone: entry.phone,
        courtName: entry.court.name,
        startsAt: entry.startsAt.toISOString(),
        businessName: settings.businessName ?? 'El local',
      });
    }

    return this.prisma.waitlistEntry.update({
      where: { id },
      data: { notified: true, notifiedAt: new Date() },
    });
  }

  async notifyFirstForSlot(courtId: string, startsAt: Date) {
    const entry = await this.prisma.waitlistEntry.findFirst({
      where: { courtId, startsAt, notified: false },
      orderBy: { createdAt: 'asc' },
    });
    if (entry) {
      await this.notifyEntry(entry.id);
    }
  }

  async countPending() {
    return this.prisma.waitlistEntry.count({
      where: {
        notified: false,
        startsAt: { gte: new Date() },
      },
    });
  }
}

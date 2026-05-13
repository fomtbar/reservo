import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async addPayment(bookingId: string, dto: CreatePaymentDto) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException(`Reserva ${bookingId} no encontrada`);
    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('No se puede registrar un pago en una reserva cancelada');
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          bookingId,
          amount: new Prisma.Decimal(dto.amount),
          method: dto.method,
        },
      });

      const agg = await tx.payment.aggregate({
        where: { bookingId },
        _sum: { amount: true },
      });

      const paidAmount = agg._sum.amount ?? new Prisma.Decimal(0);
      const paymentStatus = paidAmount.gte(booking.price)
        ? 'PAID'
        : paidAmount.gt(0)
          ? 'PARTIAL'
          : 'UNPAID';

      await tx.booking.update({
        where: { id: bookingId },
        data: { paidAmount, paymentStatus },
      });

      return payment;
    });
  }

  async removePayment(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { booking: true },
    });
    if (!payment) throw new NotFoundException(`Pago ${id} no encontrado`);

    return this.prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id } });

      const agg = await tx.payment.aggregate({
        where: { bookingId: payment.bookingId },
        _sum: { amount: true },
      });

      const paidAmount = agg._sum.amount ?? new Prisma.Decimal(0);
      const paymentStatus = paidAmount.gte(payment.booking.price)
        ? 'PAID'
        : paidAmount.gt(0)
          ? 'PARTIAL'
          : 'UNPAID';

      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { paidAmount, paymentStatus },
      });

      return { deleted: true };
    });
  }

  async getRevenueReport(fromStr: string, toStr: string) {
    const settings = await this.prisma.tenantSettings.findUnique({ where: { id: 1 } });
    const tz = settings?.timezone ?? 'America/Argentina/Buenos_Aires';

    const days: string[] = [];
    const cursor = new Date(fromStr + 'T12:00:00Z');
    const end = new Date(toStr + 'T12:00:00Z');
    while (cursor <= end) {
      days.push(cursor.toLocaleDateString('sv-SE', { timeZone: tz }));
      cursor.setDate(cursor.getDate() + 1);
    }

    const dailyRows = await Promise.all(
      days.map(async (dateStr) => {
        const { from, to } = dayBoundsUtc(dateStr, tz);
        const payments = await this.prisma.payment.findMany({
          where: { createdAt: { gte: from, lt: to } },
          select: { amount: true, method: true },
        });
        const totals: Record<string, number> = {};
        let total = 0;
        for (const p of payments) {
          const amt = Number(p.amount);
          totals[p.method] = (totals[p.method] ?? 0) + amt;
          total += amt;
        }
        return { date: dateStr, totals, total };
      }),
    );

    const methodTotals: Record<string, number> = {};
    let grandTotal = 0;
    for (const row of dailyRows) {
      for (const [method, amount] of Object.entries(row.totals)) {
        methodTotals[method] = (methodTotals[method] ?? 0) + amount;
      }
      grandTotal += row.total;
    }

    return { from: fromStr, to: toStr, days: dailyRows, methodTotals, grandTotal };
  }

  async getDailySummary(dateStr: string) {
    const settings = await this.prisma.tenantSettings.findUnique({ where: { id: 1 } });
    const tz = settings?.timezone ?? 'America/Argentina/Buenos_Aires';
    const { from, to } = dayBoundsUtc(dateStr, tz);

    const payments = await this.prisma.payment.findMany({
      where: { createdAt: { gte: from, lt: to } },
      include: {
        booking: {
          include: {
            court: { select: { id: true, name: true } },
            customer: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const totals: Record<string, number> = {};
    let grandTotal = 0;

    for (const p of payments) {
      const amount = Number(p.amount);
      totals[p.method] = (totals[p.method] ?? 0) + amount;
      grandTotal += amount;
    }

    return { date: dateStr, payments, totals, grandTotal };
  }
}

// Returns UTC boundaries for a calendar day in a given timezone.
// Requires the process to be running in UTC (default for Node Alpine containers).
function dayBoundsUtc(dateStr: string, tz: string): { from: Date; to: Date } {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const probeLocal = new Date(probe.toLocaleString('en-US', { timeZone: tz }));
  const offsetMs = probe.getTime() - probeLocal.getTime();
  const from = new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + offsetMs);
  const to = new Date(from.getTime() + 86_400_000);
  return { from, to };
}

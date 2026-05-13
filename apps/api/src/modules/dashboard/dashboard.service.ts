import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Converts a calendar day in a given timezone to UTC boundaries.
// Requires the process to run in UTC (default for Node Alpine containers).
function dayBoundsUtc(dateStr: string, tz: string): { from: Date; to: Date } {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const probeLocal = new Date(probe.toLocaleString('en-US', { timeZone: tz }));
  const offsetMs = probe.getTime() - probeLocal.getTime();
  const from = new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + offsetMs);
  const to = new Date(from.getTime() + 86_400_000);
  return { from, to };
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const settings = await this.prisma.tenantSettings.findUnique({ where: { id: 1 } });
    const tz = settings?.timezone ?? 'America/Argentina/Buenos_Aires';

    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: tz });
    const { from: todayFrom, to: todayTo } = dayBoundsUtc(todayStr, tz);

    // ── Today ────────────────────────────────────────────────────────────────

    const [todayBookings, todayRevenue, pendingHolds] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['status'],
        where: { startsAt: { gte: todayFrom, lt: todayTo } },
        _count: { id: true },
      }),
      this.prisma.payment.aggregate({
        where: { createdAt: { gte: todayFrom, lt: todayTo } },
        _sum: { amount: true },
      }),
      this.prisma.booking.findMany({
        where: { status: 'HELD', heldUntil: { gt: new Date() } },
        include: {
          court: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { heldUntil: 'asc' },
        take: 10,
      }),
    ]);

    const statusMap = Object.fromEntries(
      todayBookings.map((b) => [b.status, b._count.id]),
    );

    // ── Last 7 days revenue ───────────────────────────────────────────────────

    const weekDays: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      weekDays.push(d.toLocaleDateString('sv-SE', { timeZone: tz }));
    }

    const weekRevenue = await Promise.all(
      weekDays.map(async (dateStr) => {
        const { from, to } = dayBoundsUtc(dateStr, tz);
        const agg = await this.prisma.payment.aggregate({
          where: { createdAt: { gte: from, lt: to } },
          _sum: { amount: true },
        });
        return { date: dateStr, amount: Number(agg._sum.amount ?? 0) };
      }),
    );

    const weekTotal = weekRevenue.reduce((sum, d) => sum + d.amount, 0);

    // ── Top courts this week ──────────────────────────────────────────────────

    const weekFrom = dayBoundsUtc(weekDays[0], tz).from;

    const topCourtsRaw = await this.prisma.booking.groupBy({
      by: ['courtId'],
      where: {
        startsAt: { gte: weekFrom },
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const courtIds = topCourtsRaw.map((c) => c.courtId);
    const courts = await this.prisma.court.findMany({
      where: { id: { in: courtIds } },
      select: { id: true, name: true, color: true },
    });
    const courtMap = Object.fromEntries(courts.map((c) => [c.id, c]));

    const topCourts = topCourtsRaw
      .map((tc) => ({ ...courtMap[tc.courtId], bookingsCount: tc._count.id }))
      .filter((c) => c.id);

    // ── Monthly totals ────────────────────────────────────────────────────────

    const monthStr = todayStr.slice(0, 7); // "YYYY-MM"
    const monthFrom = new Date(`${monthStr}-01T00:00:00Z`);
    const monthRevenue = await this.prisma.payment.aggregate({
      where: { createdAt: { gte: monthFrom } },
      _sum: { amount: true },
    });

    return {
      today: {
        date: todayStr,
        bookings: {
          confirmed: statusMap['CONFIRMED'] ?? 0,
          held: statusMap['HELD'] ?? 0,
          completed: statusMap['COMPLETED'] ?? 0,
          cancelled: statusMap['CANCELLED'] ?? 0,
          noShow: statusMap['NO_SHOW'] ?? 0,
        },
        revenue: Number(todayRevenue._sum.amount ?? 0),
      },
      week: {
        revenue: weekRevenue,
        total: weekTotal,
      },
      month: {
        revenue: Number(monthRevenue._sum.amount ?? 0),
      },
      pendingHolds,
      topCourts,
    };
  }
}

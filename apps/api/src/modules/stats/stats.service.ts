import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type HeatmapRow = { dow: number; hour: number; bookings: bigint };
type LtvRow = {
  id: string;
  name: string;
  phone: string;
  total_bookings: bigint;
  total_spent: Prisma.Decimal;
  avg_ticket: Prisma.Decimal;
  first_booking: Date;
  last_booking: Date;
};

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getOccupancy(fromStr: string, toStr: string) {
    const settings = await this.prisma.tenantSettings.findUnique({ where: { id: 1 } });
    const tz = settings?.timezone ?? 'America/Argentina/Buenos_Aires';

    const from = new Date(fromStr + 'T00:00:00Z');
    const to = new Date(toStr + 'T23:59:59Z');

    const totalCourts = await this.prisma.court.count({ where: { active: true } });

    // Count bookings per (day-of-week, hour) in the tenant timezone
    const rows = await this.prisma.$queryRaw<HeatmapRow[]>`
      SELECT
        EXTRACT(DOW FROM "startsAt" AT TIME ZONE ${tz})::int AS dow,
        EXTRACT(HOUR FROM "startsAt" AT TIME ZONE ${tz})::int AS hour,
        COUNT(*)::bigint AS bookings
      FROM bookings
      WHERE status IN ('CONFIRMED', 'COMPLETED', 'NO_SHOW')
        AND "startsAt" >= ${from}
        AND "startsAt" <= ${to}
      GROUP BY dow, hour
      ORDER BY dow, hour
    `;

    // Count how many times each DOW appears in the date range (to compute maxPossible)
    const dowCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const cursor = new Date(from);
    while (cursor <= to) {
      const localDay = new Date(cursor.toLocaleString('en-US', { timeZone: tz })).getDay();
      dowCounts[localDay] = (dowCounts[localDay] ?? 0) + 1;
      cursor.setDate(cursor.getDate() + 1);
    }

    const heatmap = rows.map((r) => {
      const maxPossible = (dowCounts[r.dow] ?? 0) * totalCourts;
      const bookings = Number(r.bookings);
      return {
        dow: r.dow,
        hour: r.hour,
        bookings,
        maxPossible,
        pct: maxPossible > 0 ? Math.round((bookings / maxPossible) * 100) : 0,
      };
    });

    return { from: fromStr, to: toStr, totalCourts, dowCounts, heatmap };
  }

  async getCustomerLtv(limit = 50) {
    const rows = await this.prisma.$queryRaw<LtvRow[]>`
      SELECT
        c.id,
        c.name,
        c.phone,
        COUNT(b.id)::bigint                               AS total_bookings,
        COALESCE(SUM(b."paidAmount"), 0)::numeric         AS total_spent,
        COALESCE(AVG(b.price), 0)::numeric                AS avg_ticket,
        MIN(b."startsAt")                                 AS first_booking,
        MAX(b."startsAt")                                 AS last_booking
      FROM customers c
      JOIN bookings b ON b."customerId" = c.id
        AND b.status IN ('CONFIRMED', 'COMPLETED', 'NO_SHOW')
      GROUP BY c.id, c.name, c.phone
      ORDER BY total_spent DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      totalBookings: Number(r.total_bookings),
      totalSpent: Number(r.total_spent),
      avgTicket: Number(r.avg_ticket),
      firstBooking: r.first_booking,
      lastBooking: r.last_booking,
    }));
  }
}

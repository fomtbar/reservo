import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingRulesService } from '../pricing/pricing-rules.service';
import { PromosService } from '../promos/promos.service';
import { WaitlistService } from '../waitlist/waitlist.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { HoldBookingDto } from './dto/hold-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

const BOOKING_INCLUDE = {
  court: { select: { id: true, name: true, sport: true, color: true } },
  customer: { select: { id: true, name: true, phone: true, email: true } },
  createdBy: { select: { id: true, name: true } },
  payments: true,
} satisfies Prisma.BookingInclude;

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private pricingRules: PricingRulesService,
    private notifications: NotificationsService,
    private waitlist: WaitlistService,
    private promos: PromosService,
  ) {}

  findAll(filters: {
    courtId?: string;
    from?: string;
    to?: string;
    status?: string;
    customerId?: string;
  }) {
    const statuses = filters.status
      ? (filters.status.split(',') as BookingStatus[])
      : undefined;

    return this.prisma.booking.findMany({
      where: {
        ...(filters.courtId && { courtId: filters.courtId }),
        ...(filters.customerId && { customerId: filters.customerId }),
        ...(statuses && { status: { in: statuses } }),
        ...(filters.from || filters.to
          ? {
              startsAt: {
                ...(filters.from && { gte: new Date(filters.from) }),
                ...(filters.to && { lte: new Date(filters.to) }),
              },
            }
          : {}),
      },
      include: BOOKING_INCLUDE,
      orderBy: { startsAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });
    if (!booking) throw new NotFoundException(`Reserva ${id} no encontrada`);
    return booking;
  }

  async findPublic(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        court: { select: { name: true, sport: true } },
        customer: { select: { name: true } },
      },
    });
    if (!booking) throw new NotFoundException(`Reserva ${id} no encontrada`);
    return booking;
  }

  async create(dto: CreateBookingDto, userId: string) {
    this.assertEndsAfterStarts(dto.startsAt, dto.endsAt);

    const customerId = await this.resolveCustomerId(dto);

    const startsAt = new Date(dto.startsAt);
    const price = dto.price !== undefined
      ? new Prisma.Decimal(dto.price)
      : await this.resolvePrice(dto.courtId, startsAt);

    return this.saveBooking(() =>
      this.prisma.booking.create({
        data: {
          courtId: dto.courtId,
          startsAt,
          endsAt: new Date(dto.endsAt),
          status: 'CONFIRMED',
          source: dto.source ?? 'WALK_IN',
          customerId,
          createdById: userId,
          price,
          priceOverride: dto.price !== undefined,
          deposit: dto.deposit ? new Prisma.Decimal(dto.deposit) : new Prisma.Decimal(0),
          notes: dto.notes ?? null,
        },
        include: BOOKING_INCLUDE,
      }),
    );
  }

  async hold(dto: HoldBookingDto) {
    this.assertEndsAfterStarts(dto.startsAt, dto.endsAt);

    const settings = await this.prisma.tenantSettings.findUnique({ where: { id: 1 } });
    const holdMinutes = settings?.holdMinutes ?? 15;
    const heldUntil = new Date(Date.now() + holdMinutes * 60_000);

    const startsAt = new Date(dto.startsAt);
    const price = await this.resolvePrice(dto.courtId, startsAt);
    const priceNumber = Number(price);

    let discountAmount = 0;
    if (dto.promoCode) {
      const validation = await this.promos.validate(dto.promoCode, priceNumber, dto.courtId);
      if (!validation.valid) throw new BadRequestException(validation.reason);
      discountAmount = validation.discountAmount;
    }

    const customer = await this.prisma.customer.upsert({
      where: { phone: dto.customerPhone },
      update: {},
      create: {
        name: dto.customerName,
        phone: dto.customerPhone,
        email: dto.customerEmail ?? null,
      },
    });

    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        const b = await tx.booking.create({
          data: {
            courtId: dto.courtId,
            startsAt,
            endsAt: new Date(dto.endsAt),
            status: 'HELD',
            source: 'WEB',
            customerId: customer.id,
            price,
            discountAmount: new Prisma.Decimal(discountAmount),
            heldUntil,
          },
          include: BOOKING_INCLUDE,
        });

        if (dto.promoCode) {
          await this.promos.applyToBooking(dto.promoCode, b.id, priceNumber, dto.courtId, customer.id, tx);
        }

        return b;
      });
      return booking;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('El horario ya está reservado');
      }
      const pg = err as { code?: string };
      if (pg.code === '23P01') throw new ConflictException('El horario ya está reservado');
      throw err;
    }
  }

  async confirm(id: string, userId: string) {
    const booking = await this.findOne(id);
    if (booking.status !== 'HELD') {
      throw new BadRequestException(`Solo se puede confirmar una reserva en estado HELD (actual: ${booking.status})`);
    }
    const confirmed = await this.prisma.booking.update({
      where: { id },
      data: { status: 'CONFIRMED', heldUntil: null, createdById: userId },
      include: BOOKING_INCLUDE,
    });
    this.notifications.scheduleBookingNotifications(id).catch(() => void 0);
    return confirmed;
  }

  async cancel(id: string, dto: CancelBookingDto, _userId: string) {
    const booking = await this.findOne(id);
    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      throw new BadRequestException(`No se puede cancelar una reserva en estado ${booking.status}`);
    }
    const cancelled = await this.prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED', cancelReason: dto.reason ?? null, heldUntil: null },
      include: BOOKING_INCLUDE,
    });
    this.notifications.cancelBookingNotifications(id).catch(() => void 0);
    this.waitlist.notifyFirstForSlot(cancelled.courtId, cancelled.startsAt).catch(() => void 0);
    return cancelled;
  }

  async complete(id: string) {
    const booking = await this.findOne(id);
    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(`Solo se puede completar una reserva en estado CONFIRMED (actual: ${booking.status})`);
    }
    return this.prisma.booking.update({
      where: { id },
      data: { status: 'COMPLETED' },
      include: BOOKING_INCLUDE,
    });
  }

  async noShow(id: string) {
    const booking = await this.findOne(id);
    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(`Solo se puede marcar no-show una reserva en estado CONFIRMED (actual: ${booking.status})`);
    }
    return this.prisma.booking.update({
      where: { id },
      data: { status: 'NO_SHOW' },
      include: BOOKING_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateBookingDto) {
    await this.findOne(id);
    return this.prisma.booking.update({
      where: { id },
      data: {
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.price !== undefined && {
          price: new Prisma.Decimal(dto.price),
          priceOverride: true,
        }),
        ...(dto.deposit !== undefined && { deposit: new Prisma.Decimal(dto.deposit) }),
        ...(dto.paidAmount !== undefined && { paidAmount: new Prisma.Decimal(dto.paidAmount) }),
        ...(dto.paymentStatus !== undefined && { paymentStatus: dto.paymentStatus }),
      },
      include: BOOKING_INCLUDE,
    });
  }

  async findByPhone(phone: string) {
    const customer = await this.prisma.customer.findUnique({ where: { phone } });
    if (!customer) return [];
    return this.prisma.booking.findMany({
      where: {
        customerId: customer.id,
        status: { in: ['HELD', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
      },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        paymentStatus: true,
        heldUntil: true,
        court: { select: { name: true, sport: true } },
      },
      orderBy: { startsAt: 'desc' },
      take: 30,
    });
  }

  // Returns minimal slot data for public availability — no customer info exposed
  getAvailability(date: string) {
    const from = new Date(date + 'T00:00:00Z');
    const to = new Date(date + 'T23:59:59Z');
    return this.prisma.booking.findMany({
      where: {
        startsAt: { gte: from },
        endsAt: { lte: to },
        status: { in: ['HELD', 'CONFIRMED'] },
      },
      select: { id: true, courtId: true, startsAt: true, endsAt: true, status: true },
      orderBy: { startsAt: 'asc' },
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private assertEndsAfterStarts(startsAt: string, endsAt: string) {
    if (new Date(endsAt) <= new Date(startsAt)) {
      throw new BadRequestException('endsAt debe ser posterior a startsAt');
    }
  }

  private async resolveCustomerId(dto: CreateBookingDto): Promise<string | null> {
    if (dto.customerId) return dto.customerId;
    if (dto.customer) {
      const customer = await this.prisma.customer.upsert({
        where: { phone: dto.customer.phone },
        update: {},
        create: {
          name: dto.customer.name,
          phone: dto.customer.phone,
          email: dto.customer.email ?? null,
        },
      });
      return customer.id;
    }
    return null;
  }

  private async resolvePrice(courtId: string, startsAt: Date): Promise<Prisma.Decimal> {
    const dayOfWeek = startsAt.getDay();
    const slotTime = startsAt.toTimeString().slice(0, 5); // "HH:MM"

    const rule = await this.pricingRules.resolve({ courtId, dayOfWeek, slotTime, date: startsAt });
    return rule ? rule.amount : new Prisma.Decimal(0);
  }

  private async saveBooking<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        // 23P01 = exclusion_violation — solapamiento de horario
        const meta = e.meta as Record<string, unknown> | undefined;
        const isOverlap =
          e.code === 'P2010' &&
          (String(meta?.['code']) === '23P01' ||
            String(meta?.['message'] ?? '').includes('bookings_no_overlap'));
        if (isOverlap) {
          throw new ConflictException('El horario solicitado se solapa con otra reserva activa');
        }
      }
      throw e;
    }
  }
}

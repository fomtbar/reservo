import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private loyalty: LoyaltyService,
  ) {}

  async findAll(filters: { q?: string; page?: number; limit?: number }) {
    const page = Math.max(filters.page ?? 1, 1);
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: 'insensitive' } },
            { phone: { contains: filters.q } },
            { email: { contains: filters.q, mode: 'insensitive' } },
          ],
        }
      : {};

    const [rawData, total, config] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: [{ lastBookingAt: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
        skip,
        take: limit,
        include: { _count: { select: { bookings: true } } },
      }),
      this.prisma.customer.count({ where }),
      this.loyalty.getConfig(),
    ]);

    const data = rawData.map((c) => ({
      ...c,
      loyalty: this.loyalty.computeTier(c.totalBookings, config),
    }));

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const [customer, config] = await Promise.all([
      this.prisma.customer.findUnique({
        where: { id },
        include: {
          bookings: {
            orderBy: { startsAt: 'desc' },
            take: 20,
            include: { court: { select: { id: true, name: true, sport: true } } },
          },
        },
      }),
      this.loyalty.getConfig(),
    ]);
    if (!customer) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return { ...customer, loyalty: this.loyalty.computeTier(customer.totalBookings, config) };
  }

  async create(dto: CreateCustomerDto) {
    try {
      return await this.prisma.customer.create({ data: dto });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Ya existe un cliente con el teléfono ${dto.phone}`);
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    try {
      return await this.prisma.customer.update({ where: { id }, data: dto });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Ya existe un cliente con el teléfono ${dto.phone}`);
      }
      throw e;
    }
  }
}

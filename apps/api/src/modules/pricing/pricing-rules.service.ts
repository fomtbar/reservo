import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';
import { UpdatePricingRuleDto } from './dto/update-pricing-rule.dto';

@Injectable()
export class PricingRulesService {
  constructor(private prisma: PrismaService) {}

  findAll(filters: { courtId?: string; active?: boolean }) {
    return this.prisma.pricingRule.findMany({
      where: {
        ...(filters.courtId !== undefined && {
          courtId: filters.courtId === 'null' ? null : filters.courtId,
        }),
        ...(filters.active !== undefined && { active: filters.active }),
      },
      orderBy: [{ priority: 'desc' }, { label: 'asc' }],
    });
  }

  async findOne(id: string) {
    const rule = await this.prisma.pricingRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException(`Regla de precio ${id} no encontrada`);
    return rule;
  }

  create(dto: CreatePricingRuleDto) {
    return this.prisma.pricingRule.create({
      data: {
        label: dto.label,
        amount: new Prisma.Decimal(dto.amount),
        courtId: dto.courtId ?? null,
        dayOfWeek: dto.dayOfWeek ?? null,
        startTime: dto.startTime ?? null,
        endTime: dto.endTime ?? null,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        priority: dto.priority ?? 0,
        active: dto.active ?? true,
      },
    });
  }

  async update(id: string, dto: UpdatePricingRuleDto) {
    await this.findOne(id);
    return this.prisma.pricingRule.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.amount !== undefined && { amount: new Prisma.Decimal(dto.amount) }),
        ...(dto.courtId !== undefined && { courtId: dto.courtId ?? null }),
        ...(dto.dayOfWeek !== undefined && { dayOfWeek: dto.dayOfWeek ?? null }),
        ...(dto.startTime !== undefined && { startTime: dto.startTime ?? null }),
        ...(dto.endTime !== undefined && { endTime: dto.endTime ?? null }),
        ...(dto.validFrom !== undefined && { validFrom: dto.validFrom ? new Date(dto.validFrom) : null }),
        ...(dto.validUntil !== undefined && { validUntil: dto.validUntil ? new Date(dto.validUntil) : null }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.pricingRule.update({ where: { id }, data: { active: false } });
  }

  /**
   * Resuelve el precio aplicable para un slot dado.
   * Devuelve la regla con mayor priority que coincide con los criterios,
   * o null si no hay ninguna activa.
   */
  async resolve(params: {
    courtId: string;
    dayOfWeek: number;   // 0-6
    slotTime: string;    // "HH:MM" — inicio del slot
    date: Date;
  }) {
    const { courtId, dayOfWeek, slotTime, date } = params;

    const rules = await this.prisma.pricingRule.findMany({
      where: {
        active: true,
        OR: [{ courtId }, { courtId: null }],
      },
      orderBy: { priority: 'desc' },
    });

    for (const rule of rules) {
      if (rule.dayOfWeek !== null && rule.dayOfWeek !== dayOfWeek) continue;
      if (rule.startTime && rule.endTime) {
        if (slotTime < rule.startTime || slotTime >= rule.endTime) continue;
      }
      if (rule.validFrom && date < rule.validFrom) continue;
      if (rule.validUntil && date > rule.validUntil) continue;
      return rule;
    }

    return null;
  }
}

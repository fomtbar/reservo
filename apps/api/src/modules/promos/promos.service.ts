import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePromoDto } from './dto/create-promo.dto';
import { UpdatePromoDto } from './dto/update-promo.dto';

export type ValidateResult =
  | { valid: true; code: string; discountAmount: number; finalAmount: number; description?: string | null }
  | { valid: false; reason: string };

@Injectable()
export class PromosService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreatePromoDto) {
    return this.prisma.promoCode.create({
      data: {
        code: dto.code.toUpperCase().trim(),
        description: dto.description ?? null,
        type: dto.type,
        value: new Prisma.Decimal(dto.value),
        minAmount: dto.minAmount != null ? new Prisma.Decimal(dto.minAmount) : null,
        maxUses: dto.maxUses ?? null,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        courtIds: dto.courtIds ?? [],
        active: dto.active ?? true,
      },
    });
  }

  findAll() {
    return this.prisma.promoCode.findMany({
      include: { _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const p = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!p) throw new NotFoundException(`Código ${id} no encontrado`);
    return p;
  }

  async update(id: string, dto: UpdatePromoDto) {
    await this.findOne(id);
    return this.prisma.promoCode.update({
      where: { id },
      data: {
        ...(dto.code && { code: dto.code.toUpperCase().trim() }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type && { type: dto.type }),
        ...(dto.value != null && { value: new Prisma.Decimal(dto.value) }),
        ...(dto.minAmount !== undefined && { minAmount: dto.minAmount != null ? new Prisma.Decimal(dto.minAmount) : null }),
        ...(dto.maxUses !== undefined && { maxUses: dto.maxUses ?? null }),
        ...(dto.validFrom !== undefined && { validFrom: dto.validFrom ? new Date(dto.validFrom) : null }),
        ...(dto.validUntil !== undefined && { validUntil: dto.validUntil ? new Date(dto.validUntil) : null }),
        ...(dto.courtIds !== undefined && { courtIds: dto.courtIds ?? [] }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.promoCode.update({ where: { id }, data: { active: false } });
  }

  async validate(code: string, amount: number, courtId?: string): Promise<ValidateResult> {
    const promo = await this.prisma.promoCode.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!promo || !promo.active) return { valid: false, reason: 'Código inválido o inactivo' };

    const now = new Date();
    if (promo.validFrom && now < promo.validFrom) return { valid: false, reason: 'El código aún no está vigente' };
    if (promo.validUntil && now > promo.validUntil) return { valid: false, reason: 'El código expiró' };
    if (promo.maxUses !== null && promo.usesCount >= promo.maxUses) return { valid: false, reason: 'El código ya alcanzó su límite de usos' };
    if (promo.minAmount && amount < Number(promo.minAmount)) {
      return { valid: false, reason: `El monto mínimo para este código es $${promo.minAmount}` };
    }
    if (promo.courtIds.length > 0 && courtId && !promo.courtIds.includes(courtId)) {
      return { valid: false, reason: 'El código no aplica a esta cancha' };
    }

    const rawDiscount = promo.type === 'PERCENTAGE'
      ? amount * (Number(promo.value) / 100)
      : Number(promo.value);
    const discountAmount = Math.min(Math.round(rawDiscount), amount);

    return {
      valid: true,
      code: promo.code,
      discountAmount,
      finalAmount: amount - discountAmount,
      description: promo.description,
    };
  }

  async applyToBooking(
    promoCode: string,
    bookingId: string,
    bookingPrice: number,
    courtId: string,
    customerId: string | null,
    tx: Prisma.TransactionClient,
  ) {
    const validation = await this.validate(promoCode, bookingPrice, courtId);
    if (!validation.valid) throw new BadRequestException(validation.reason);

    const promo = await tx.promoCode.findUnique({ where: { code: promoCode.toUpperCase().trim() } });
    if (!promo) throw new BadRequestException('Código no encontrado');

    await tx.promoApplication.create({
      data: {
        promoCodeId: promo.id,
        bookingId,
        customerId,
        discountAmount: new Prisma.Decimal(validation.discountAmount),
      },
    });
    await tx.promoCode.update({ where: { id: promo.id }, data: { usesCount: { increment: 1 } } });

    return validation;
  }
}

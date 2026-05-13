import { Injectable } from '@nestjs/common';
import { LoyaltyConfig } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateLoyaltyDto } from './dto/update-loyalty.dto';

export type LoyaltyTier = 'NONE' | 'SILVER' | 'GOLD';

export interface CustomerLoyalty {
  tier: LoyaltyTier;
  totalBookings: number;
  discountPct: number;
  nextTier: LoyaltyTier | null;
  bookingsToNextTier: number | null;
}

@Injectable()
export class LoyaltyService {
  constructor(private prisma: PrismaService) {}

  async getConfig(): Promise<LoyaltyConfig> {
    return this.prisma.loyaltyConfig.upsert({
      where: { id: 1 },
      create: {},
      update: {},
    });
  }

  async updateConfig(dto: UpdateLoyaltyDto): Promise<LoyaltyConfig> {
    return this.prisma.loyaltyConfig.upsert({
      where: { id: 1 },
      create: { ...dto },
      update: { ...dto },
    });
  }

  async getCustomerLoyalty(customerId: string): Promise<CustomerLoyalty | null> {
    const [customer, config] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: customerId }, select: { totalBookings: true } }),
      this.getConfig(),
    ]);
    if (!customer) return null;
    return this.computeTier(customer.totalBookings, config);
  }

  computeTier(totalBookings: number, config: LoyaltyConfig): CustomerLoyalty {
    if (!config.enabled) {
      return { tier: 'NONE', totalBookings, discountPct: 0, nextTier: null, bookingsToNextTier: null };
    }

    let tier: LoyaltyTier = 'NONE';
    let discountPct = 0;

    if (totalBookings >= config.goldMinBookings) {
      tier = 'GOLD';
      discountPct = config.goldDiscountPct;
    } else if (totalBookings >= config.silverMinBookings) {
      tier = 'SILVER';
      discountPct = config.silverDiscountPct;
    }

    let nextTier: LoyaltyTier | null = null;
    let bookingsToNextTier: number | null = null;

    if (tier === 'NONE') {
      nextTier = 'SILVER';
      bookingsToNextTier = config.silverMinBookings - totalBookings;
    } else if (tier === 'SILVER') {
      nextTier = 'GOLD';
      bookingsToNextTier = config.goldMinBookings - totalBookings;
    }

    return { tier, totalBookings, discountPct, nextTier, bookingsToNextTier };
  }
}

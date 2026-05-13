import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async findOne() {
    const settings = await this.prisma.tenantSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
    const { mpAccessToken, ...rest } = settings;
    return { ...rest, mpAccessTokenConfigured: !!mpAccessToken };
  }

  async findPublic() {
    const settings = await this.prisma.tenantSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
    return {
      businessName: settings.businessName,
      logoUrl: settings.logoUrl,
      primaryColor: settings.primaryColor,
      allowWebBooking: settings.allowWebBooking,
      requireDepositForWeb: settings.requireDepositForWeb,
      mpEnabled: !!settings.mpAccessToken,
      holdMinutes: settings.holdMinutes,
      currency: settings.currency,
    };
  }

  async update(dto: UpdateSettingsDto) {
    const settings = await this.prisma.tenantSettings.upsert({
      where: { id: 1 },
      update: dto,
      create: { id: 1, ...dto },
    });
    const { mpAccessToken, ...rest } = settings;
    return { ...rest, mpAccessTokenConfigured: !!mpAccessToken };
  }
}

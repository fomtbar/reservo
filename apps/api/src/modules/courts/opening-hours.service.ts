import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BulkReplaceHoursDto } from './dto/bulk-replace-hours.dto';
import { CreateOpeningHourDto } from './dto/create-opening-hour.dto';
import { UpdateOpeningHourDto } from './dto/update-opening-hour.dto';

@Injectable()
export class OpeningHoursService {
  constructor(private prisma: PrismaService) {}

  findAll(courtId?: string | null) {
    if (courtId === null) {
      return this.prisma.openingHour.findMany({
        where: { courtId: null },
        orderBy: [{ dayOfWeek: 'asc' }, { opensAt: 'asc' }],
      });
    }
    return this.prisma.openingHour.findMany({
      where: courtId !== undefined ? { courtId } : undefined,
      orderBy: [{ dayOfWeek: 'asc' }, { opensAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const oh = await this.prisma.openingHour.findUnique({ where: { id } });
    if (!oh) throw new NotFoundException(`Horario ${id} no encontrado`);
    return oh;
  }

  create(dto: CreateOpeningHourDto) {
    return this.prisma.openingHour.create({
      data: {
        courtId: dto.courtId ?? null,
        dayOfWeek: dto.dayOfWeek,
        opensAt: dto.opensAt,
        closesAt: dto.closesAt,
      },
    });
  }

  async update(id: string, dto: UpdateOpeningHourDto) {
    await this.findOne(id);
    return this.prisma.openingHour.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.openingHour.delete({ where: { id } });
  }

  async bulkReplace(dto: BulkReplaceHoursDto) {
    const courtId = dto.courtId ?? null;
    const [, created] = await this.prisma.$transaction([
      this.prisma.openingHour.deleteMany({ where: { courtId } }),
      this.prisma.openingHour.createMany({
        data: dto.hours.map((h) => ({
          courtId,
          dayOfWeek: h.dayOfWeek,
          opensAt: h.opensAt,
          closesAt: h.closesAt,
        })),
      }),
    ]);
    return created;
  }
}

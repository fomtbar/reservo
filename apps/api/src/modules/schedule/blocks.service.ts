import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBlockDto } from './dto/create-block.dto';

@Injectable()
export class BlocksService {
  constructor(private prisma: PrismaService) {}

  findAll(filters: { courtId?: string; from?: string; to?: string }) {
    return this.prisma.block.findMany({
      where: {
        ...(filters.courtId && { courtId: filters.courtId }),
        ...(filters.from || filters.to
          ? {
              startsAt: {
                ...(filters.from && { gte: new Date(filters.from) }),
                ...(filters.to && { lte: new Date(filters.to) }),
              },
            }
          : {}),
      },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: [{ startsAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const block = await this.prisma.block.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    if (!block) throw new NotFoundException(`Bloqueo ${id} no encontrado`);
    return block;
  }

  create(dto: CreateBlockDto, createdById: string) {
    if (new Date(dto.endsAt) <= new Date(dto.startsAt)) {
      throw new BadRequestException('endsAt debe ser posterior a startsAt');
    }
    return this.prisma.block.create({
      data: {
        courtId: dto.courtId,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        reason: dto.reason ?? null,
        createdById,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.block.delete({ where: { id } });
  }
}

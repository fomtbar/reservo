import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateScheduleExceptionDto } from './dto/create-schedule-exception.dto';
import { UpdateScheduleExceptionDto } from './dto/update-schedule-exception.dto';

@Injectable()
export class ScheduleExceptionsService {
  constructor(private prisma: PrismaService) {}

  findAll(filters: { courtId?: string; from?: string; to?: string }) {
    return this.prisma.scheduleException.findMany({
      where: {
        ...(filters.courtId !== undefined && { courtId: filters.courtId === 'null' ? null : filters.courtId }),
        ...(filters.from || filters.to
          ? {
              date: {
                ...(filters.from && { gte: new Date(filters.from) }),
                ...(filters.to && { lte: new Date(filters.to) }),
              },
            }
          : {}),
      },
      orderBy: [{ date: 'asc' }, { courtId: 'asc' }],
    });
  }

  async findOne(id: string) {
    const exc = await this.prisma.scheduleException.findUnique({ where: { id } });
    if (!exc) throw new NotFoundException(`Excepción ${id} no encontrada`);
    return exc;
  }

  create(dto: CreateScheduleExceptionDto) {
    return this.prisma.scheduleException.create({
      data: {
        courtId: dto.courtId ?? null,
        date: new Date(dto.date),
        opensAt: dto.opensAt ?? null,
        closesAt: dto.closesAt ?? null,
        closedAllDay: dto.closedAllDay ?? false,
        reason: dto.reason ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateScheduleExceptionDto) {
    await this.findOne(id);
    return this.prisma.scheduleException.update({
      where: { id },
      data: {
        ...(dto.courtId !== undefined && { courtId: dto.courtId ?? null }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.opensAt !== undefined && { opensAt: dto.opensAt ?? null }),
        ...(dto.closesAt !== undefined && { closesAt: dto.closesAt ?? null }),
        ...(dto.closedAllDay !== undefined && { closedAllDay: dto.closedAllDay }),
        ...(dto.reason !== undefined && { reason: dto.reason ?? null }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.scheduleException.delete({ where: { id } });
  }
}

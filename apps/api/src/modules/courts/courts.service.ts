import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';

@Injectable()
export class CourtsService {
  constructor(private prisma: PrismaService) {}

  findAll(opts: { includeInactive?: boolean; branchId?: string } = {}) {
    return this.prisma.court.findMany({
      where: {
        ...(opts.includeInactive ? {} : { active: true }),
        ...(opts.branchId ? { branchId: opts.branchId } : {}),
      },
      include: { branch: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const court = await this.prisma.court.findUnique({ where: { id } });
    if (!court) throw new NotFoundException(`Cancha ${id} no encontrada`);
    return court;
  }

  create(dto: CreateCourtDto) {
    return this.prisma.court.create({ data: dto });
  }

  async update(id: string, dto: UpdateCourtDto) {
    await this.findOne(id);
    return this.prisma.court.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.court.update({ where: { id }, data: { active: false } });
  }
}

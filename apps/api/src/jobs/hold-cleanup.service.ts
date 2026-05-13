import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HoldCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HoldCleanupService.name);
  private timer!: ReturnType<typeof setInterval>;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    // Run once at startup, then every 60s
    this.cleanup();
    this.timer = setInterval(() => this.cleanup(), 60_000);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async cleanup() {
    const result = await this.prisma.booking.updateMany({
      where: {
        status: 'HELD',
        heldUntil: { lt: new Date() },
      },
      data: {
        status: 'CANCELLED',
        cancelReason: 'Pre-reserva expirada automáticamente',
        heldUntil: null,
      },
    });
    if (result.count > 0) {
      this.logger.log(`Hold cleanup: ${result.count} pre-reserva(s) expirada(s) canceladas`);
    }
  }
}

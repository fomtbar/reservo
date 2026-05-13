import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HoldCleanupService } from './hold-cleanup.service';

@Module({
  imports: [PrismaModule],
  providers: [HoldCleanupService],
})
export class JobsModule {}

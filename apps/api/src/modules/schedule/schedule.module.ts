import { Module } from '@nestjs/common';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';
import { ScheduleExceptionsController } from './schedule-exceptions.controller';
import { ScheduleExceptionsService } from './schedule-exceptions.service';

@Module({
  controllers: [ScheduleExceptionsController, BlocksController],
  providers: [ScheduleExceptionsService, BlocksService],
  exports: [ScheduleExceptionsService, BlocksService],
})
export class ScheduleModule {}

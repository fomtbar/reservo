import { Module } from '@nestjs/common';
import { CourtsController } from './courts.controller';
import { CourtsService } from './courts.service';
import { OpeningHoursController } from './opening-hours.controller';
import { OpeningHoursService } from './opening-hours.service';

@Module({
  controllers: [CourtsController, OpeningHoursController],
  providers: [CourtsService, OpeningHoursService],
  exports: [CourtsService, OpeningHoursService],
})
export class CourtsModule {}

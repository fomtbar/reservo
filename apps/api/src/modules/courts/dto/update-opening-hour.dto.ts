import { PartialType } from '@nestjs/swagger';
import { CreateOpeningHourDto } from './create-opening-hour.dto';

export class UpdateOpeningHourDto extends PartialType(CreateOpeningHourDto) {}

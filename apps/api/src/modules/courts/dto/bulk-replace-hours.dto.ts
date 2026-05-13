import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CreateOpeningHourDto } from './create-opening-hour.dto';

export class BulkReplaceHoursDto {
  @ApiPropertyOptional({ description: 'null = reemplaza los horarios globales' })
  @IsOptional()
  @IsString()
  courtId?: string;

  @ApiProperty({ type: [CreateOpeningHourDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOpeningHourDto)
  hours!: CreateOpeningHourDto[];
}

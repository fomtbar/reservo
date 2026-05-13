import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, Matches } from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateScheduleExceptionDto {
  @ApiPropertyOptional({ description: 'null = aplica a todas las canchas' })
  @IsOptional()
  @IsString()
  courtId?: string;

  @ApiProperty({ example: '2026-12-25', description: 'Fecha ISO YYYY-MM-DD' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: 'opensAt debe tener formato HH:MM' })
  opensAt?: string;

  @ApiPropertyOptional({ example: '20:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: 'closesAt debe tener formato HH:MM' })
  closesAt?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  closedAllDay?: boolean;

  @ApiPropertyOptional({ example: 'Feriado nacional' })
  @IsOptional()
  @IsString()
  reason?: string;
}

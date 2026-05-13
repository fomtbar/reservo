import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreatePricingRuleDto {
  @ApiProperty({ example: 'Fin de semana noche' })
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiProperty({ example: 5000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ description: 'null = aplica a todas las canchas' })
  @IsOptional()
  @IsString()
  courtId?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 6, description: '0=domingo … 6=sábado; null = todos los días' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiPropertyOptional({ example: '18:00', description: 'Inicio del rango horario (HH:MM)' })
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: 'startTime debe tener formato HH:MM' })
  startTime?: string;

  @ApiPropertyOptional({ example: '23:00', description: 'Fin del rango horario (HH:MM)' })
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: 'endTime debe tener formato HH:MM' })
  endTime?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Vigencia desde (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Vigencia hasta (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ default: 0, description: 'Mayor número = mayor prioridad en conflictos' })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

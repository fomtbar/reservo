import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Matches,
} from 'class-validator';
import { PromoType } from '@prisma/client';

export class CreatePromoDto {
  @ApiProperty({ example: 'VERANO20' })
  @IsString()
  @Matches(/^[A-Z0-9_-]{2,20}$/, { message: 'El código debe ser alfanumérico, 2-20 caracteres, en mayúsculas' })
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PromoType })
  @IsEnum(PromoType)
  type!: PromoType;

  @ApiProperty({ description: 'Porcentaje (0-100) o monto fijo' })
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ type: [String], description: 'IDs de canchas; vacío = todas' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  courtIds?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCourtDto {
  @ApiProperty({ example: 'Cancha 1' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'paddle' })
  @IsString()
  @MinLength(1)
  sport!: string;

  @ApiPropertyOptional({ example: '#3B82F6', default: '#3B82F6' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: 60, description: 'Duración del slot en minutos' })
  @IsOptional()
  @IsInt()
  @Min(15)
  defaultSlotMinutes?: number;

  @ApiPropertyOptional({ default: 0, description: 'Buffer entre turnos en minutos' })
  @IsOptional()
  @IsInt()
  @Min(0)
  bufferMinutes?: number;

  @ApiPropertyOptional({ description: 'ID de la sucursal a la que pertenece la cancha' })
  @IsOptional()
  @IsString()
  branchId?: string;
}

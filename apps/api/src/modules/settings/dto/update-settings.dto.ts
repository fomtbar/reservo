import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'Mi Club de Paddle' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  businessName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ example: '#3B82F6' })
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @ApiPropertyOptional({ example: 'America/Argentina/Buenos_Aires' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'ARS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Minutos que dura un hold de reserva web', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  holdMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowWebBooking?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireDepositForWeb?: boolean;

  @ApiPropertyOptional({ description: 'Horas mínimas de anticipación para cancelar', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  cancellationPolicyHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Access token de Mercado Pago (se guarda cifrado en fase 2)' })
  @IsOptional()
  @IsString()
  mpAccessToken?: string;
}

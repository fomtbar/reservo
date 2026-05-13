import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';


export class HoldBookingDto {
  @ApiProperty()
  @IsString()
  courtId!: string;

  @ApiProperty({ example: '2026-05-20T10:00:00-03:00' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ example: '2026-05-20T11:00:00-03:00' })
  @IsDateString()
  endsAt!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  customerName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  customerPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiPropertyOptional({ description: 'Código de descuento (promo)' })
  @IsOptional()
  @IsString()
  promoCode?: string;
}

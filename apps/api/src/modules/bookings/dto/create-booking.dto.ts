import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingSource } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class InlineCustomerDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class CreateBookingDto {
  @ApiProperty()
  @IsString()
  courtId!: string;

  @ApiProperty({ example: '2026-05-20T10:00:00-03:00' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ example: '2026-05-20T11:00:00-03:00' })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ enum: BookingSource, default: BookingSource.WALK_IN })
  @IsOptional()
  @IsEnum(BookingSource)
  source?: BookingSource;

  @ApiPropertyOptional({ description: 'ID de cliente existente' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Crear cliente inline si no existe' })
  @IsOptional()
  @ValidateNested()
  @Type(() => InlineCustomerDto)
  customer?: InlineCustomerDto;

  @ApiPropertyOptional({ description: 'Precio manual (activa priceOverride)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deposit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

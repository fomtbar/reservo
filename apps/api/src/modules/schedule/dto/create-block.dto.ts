import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateBlockDto {
  @ApiProperty()
  @IsString()
  courtId!: string;

  @ApiProperty({ example: '2026-05-15T10:00:00-03:00' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ example: '2026-05-15T12:00:00-03:00' })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ example: 'Mantenimiento de piso' })
  @IsOptional()
  @IsString()
  reason?: string;
}

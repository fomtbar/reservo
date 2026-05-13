import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateOpeningHourDto {
  @ApiPropertyOptional({ description: 'null = aplica a todas las canchas' })
  @IsOptional()
  @IsString()
  courtId?: string;

  @ApiProperty({ minimum: 0, maximum: 6, description: '0=domingo … 6=sábado' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: '08:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'opensAt debe tener formato HH:MM (00:00 – 23:59)' })
  opensAt!: string;

  @ApiProperty({ example: '22:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'closesAt debe tener formato HH:MM (00:00 – 23:59)' })
  closesAt!: string;
}

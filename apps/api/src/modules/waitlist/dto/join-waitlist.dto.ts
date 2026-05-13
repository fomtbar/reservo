import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class JoinWaitlistDto {
  @IsString()
  courtId!: string;

  @IsString()
  startsAt!: string;

  @IsString()
  endsAt!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(6)
  phone!: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}

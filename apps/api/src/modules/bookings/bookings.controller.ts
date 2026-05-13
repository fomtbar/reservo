import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { HoldBookingDto } from './dto/hold-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  @Get()
  @ApiQuery({ name: 'courtId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO datetime (inclusive)' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO datetime (inclusive)' })
  @ApiQuery({ name: 'status', required: false, description: 'Uno o varios separados por coma', enum: BookingStatus })
  @ApiQuery({ name: 'customerId', required: false })
  findAll(
    @Query('courtId') courtId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.service.findAll({ courtId, from, to, status, customerId });
  }

  @Get('availability')
  @SkipAuth()
  @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })
  getAvailability(@Query('date') date: string) {
    return this.service.getAvailability(date);
  }

  @Get('by-phone')
  @SkipAuth()
  @ApiQuery({ name: 'phone', required: true })
  getByPhone(@Query('phone') phone: string) {
    return this.service.findByPhone(phone);
  }

  @Get(':id/public')
  @SkipAuth()
  findPublic(@Param('id') id: string) {
    return this.service.findPublic(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: { id: string }) {
    return this.service.create(dto, user.id);
  }

  @Post('hold')
  @SkipAuth()
  @HttpCode(HttpStatus.CREATED)
  hold(@Body() dto: HoldBookingDto) {
    return this.service.hold(dto);
  }

  @Post(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.service.confirm(id, user.id);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.cancel(id, dto, user.id);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.service.complete(id);
  }

  @Post(':id/no-show')
  noShow(@Param('id') id: string) {
    return this.service.noShow(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBookingDto) {
    return this.service.update(id, dto);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsString } from 'class-validator';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { MpCheckoutService } from './mp-checkout.service';
import { PaymentsService } from './payments.service';

class CreateMpCheckoutDto {
  @IsString()
  returnBaseUrl!: string;
}

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PaymentsController {
  constructor(
    private readonly service: PaymentsService,
    private readonly mpCheckout: MpCheckoutService,
  ) {}

  @Post('bookings/:bookingId/payments')
  @HttpCode(HttpStatus.CREATED)
  addPayment(
    @Param('bookingId') bookingId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.service.addPayment(bookingId, dto);
  }

  @Delete('payments/:id')
  @Roles(Role.OWNER, Role.MANAGER)
  removePayment(@Param('id') id: string) {
    return this.service.removePayment(id);
  }

  @Get('cash-register')
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD (por defecto hoy)' })
  getDailySummary(@Query('date') date?: string) {
    const dateStr = date ?? new Date().toISOString().slice(0, 10);
    return this.service.getDailySummary(dateStr);
  }

  @Get('reports/revenue')
  @ApiQuery({ name: 'from', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: true, description: 'YYYY-MM-DD' })
  getRevenueReport(@Query('from') from: string, @Query('to') to: string) {
    return this.service.getRevenueReport(from, to);
  }

  @Post('bookings/:bookingId/mp-checkout')
  @SkipAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ type: CreateMpCheckoutDto })
  createMpCheckout(
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateMpCheckoutDto,
  ) {
    return this.mpCheckout.createPreference(bookingId, dto.returnBaseUrl);
  }
}

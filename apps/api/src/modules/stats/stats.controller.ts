import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StatsService } from './stats.service';

@ApiTags('stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly service: StatsService) {}

  @Get('occupancy')
  @ApiQuery({ name: 'from', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: true, description: 'YYYY-MM-DD' })
  getOccupancy(@Query('from') from: string, @Query('to') to: string) {
    return this.service.getOccupancy(from, to);
  }

  @Get('customers/ltv')
  @ApiQuery({ name: 'limit', required: false, description: 'Máximo de clientes (default 50)' })
  getCustomerLtv(@Query('limit') limit?: string) {
    return this.service.getCustomerLtv(limit ? parseInt(limit) : 50);
  }
}

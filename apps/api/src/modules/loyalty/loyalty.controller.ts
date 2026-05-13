import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateLoyaltyDto } from './dto/update-loyalty.dto';
import { LoyaltyService } from './loyalty.service';

@ApiTags('loyalty')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly service: LoyaltyService) {}

  @Get('config')
  getConfig() {
    return this.service.getConfig();
  }

  @Patch('config')
  @Roles(Role.OWNER)
  updateConfig(@Body() dto: UpdateLoyaltyDto) {
    return this.service.updateConfig(dto);
  }

  @Get('customers/:id')
  getCustomerLoyalty(@Param('id') id: string) {
    return this.service.getCustomerLoyalty(id);
  }
}

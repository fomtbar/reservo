import {
  Body,
  Controller,
  Delete,
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
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';
import { UpdatePricingRuleDto } from './dto/update-pricing-rule.dto';
import { PricingRulesService } from './pricing-rules.service';

@ApiTags('pricing-rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pricing-rules')
export class PricingRulesController {
  constructor(private readonly service: PricingRulesService) {}

  @Get()
  @ApiQuery({ name: 'courtId', required: false, description: '"null" = solo globales' })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  findAll(
    @Query('courtId') courtId?: string,
    @Query('active') active?: string,
  ) {
    return this.service.findAll({
      courtId,
      active: active !== undefined ? active === 'true' : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.OWNER, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePricingRuleDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdatePricingRuleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

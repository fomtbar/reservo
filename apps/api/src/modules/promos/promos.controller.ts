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
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePromoDto } from './dto/create-promo.dto';
import { UpdatePromoDto } from './dto/update-promo.dto';
import { PromosService } from './promos.service';

@ApiTags('promos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('promo-codes')
export class PromosController {
  constructor(private readonly service: PromosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.OWNER, Role.MANAGER)
  create(@Body() dto: CreatePromoDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles(Role.OWNER, Role.MANAGER)
  findAll() {
    return this.service.findAll();
  }

  @Get('validate')
  @SkipAuth()
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'amount', required: true, description: 'Precio de la reserva' })
  @ApiQuery({ name: 'courtId', required: false })
  async validateCode(
    @Query('code') code: string,
    @Query('amount') amount: string,
    @Query('courtId') courtId?: string,
  ) {
    return this.service.validate(code, parseFloat(amount), courtId);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdatePromoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

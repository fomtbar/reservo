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
import { CreateScheduleExceptionDto } from './dto/create-schedule-exception.dto';
import { UpdateScheduleExceptionDto } from './dto/update-schedule-exception.dto';
import { ScheduleExceptionsService } from './schedule-exceptions.service';

@ApiTags('schedule-exceptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedule-exceptions')
export class ScheduleExceptionsController {
  constructor(private readonly service: ScheduleExceptionsService) {}

  @Get()
  @ApiQuery({ name: 'courtId', required: false, description: '"null" = solo globales' })
  @ApiQuery({ name: 'from', required: false, description: 'Fecha ISO YYYY-MM-DD (inclusive)' })
  @ApiQuery({ name: 'to', required: false, description: 'Fecha ISO YYYY-MM-DD (inclusive)' })
  findAll(
    @Query('courtId') courtId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findAll({ courtId, from, to });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.OWNER, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateScheduleExceptionDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateScheduleExceptionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

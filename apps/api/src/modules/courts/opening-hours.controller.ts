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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BulkReplaceHoursDto } from './dto/bulk-replace-hours.dto';
import { CreateOpeningHourDto } from './dto/create-opening-hour.dto';
import { UpdateOpeningHourDto } from './dto/update-opening-hour.dto';
import { OpeningHoursService } from './opening-hours.service';

@ApiTags('opening-hours')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('opening-hours')
export class OpeningHoursController {
  constructor(private readonly openingHoursService: OpeningHoursService) {}

  @Get()
  @SkipAuth()
  @ApiQuery({ name: 'courtId', required: false, description: 'Filtrar por cancha. Omitir = todos. "null" = solo globales' })
  findAll(@Query('courtId') courtId?: string) {
    const filter = courtId === 'null' ? null : courtId;
    return this.openingHoursService.findAll(filter);
  }

  @Get(':id')
  @SkipAuth()
  findOne(@Param('id') id: string) {
    return this.openingHoursService.findOne(id);
  }

  @Post()
  @Roles(Role.OWNER, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateOpeningHourDto) {
    return this.openingHoursService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateOpeningHourDto) {
    return this.openingHoursService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.openingHoursService.remove(id);
  }

  @Put('bulk')
  @Roles(Role.OWNER, Role.MANAGER)
  bulkReplace(@Body() dto: BulkReplaceHoursDto) {
    return this.openingHoursService.bulkReplace(dto);
  }
}

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
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CourtsService } from './courts.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';

@ApiTags('courts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('courts')
export class CourtsController {
  constructor(private readonly courtsService: CourtsService) {}

  @Get()
  @SkipAuth()
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiQuery({ name: 'branchId', required: false })
  findAll(
    @Query('includeInactive') includeInactive?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.courtsService.findAll({ includeInactive: includeInactive === 'true', branchId });
  }

  @Get(':id')
  @SkipAuth()
  findOne(@Param('id') id: string) {
    return this.courtsService.findOne(id);
  }

  @Post()
  @Roles(Role.OWNER, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCourtDto) {
    return this.courtsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateCourtDto) {
    return this.courtsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.courtsService.remove(id);
  }
}

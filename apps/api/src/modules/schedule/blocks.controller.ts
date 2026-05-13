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
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BlocksService } from './blocks.service';
import { CreateBlockDto } from './dto/create-block.dto';

@ApiTags('blocks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('blocks')
export class BlocksController {
  constructor(private readonly service: BlocksService) {}

  @Get()
  @ApiQuery({ name: 'courtId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO datetime (inclusive)' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO datetime (inclusive)' })
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
  create(@Body() dto: CreateBlockDto, @CurrentUser() user: { id: string }) {
    return this.service.create(dto, user.id);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

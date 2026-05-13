import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get('public')
  @SkipAuth()
  findPublic() {
    return this.service.findPublic();
  }

  @Get()
  findOne() {
    return this.service.findOne();
  }

  @Patch()
  @Roles(Role.OWNER)
  update(@Body() dto: UpdateSettingsDto) {
    return this.service.update(dto);
  }
}

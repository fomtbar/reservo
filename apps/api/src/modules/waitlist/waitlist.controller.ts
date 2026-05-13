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
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { WaitlistService } from './waitlist.service';

@ApiTags('waitlist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly service: WaitlistService) {}

  @Post()
  @SkipAuth()
  @HttpCode(HttpStatus.CREATED)
  join(@Body() dto: JoinWaitlistDto) {
    return this.service.join(dto);
  }

  @Get()
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'courtId', required: false })
  @ApiQuery({ name: 'notified', required: false })
  findAll(
    @Query('date') date?: string,
    @Query('courtId') courtId?: string,
    @Query('notified') notified?: string,
  ) {
    return this.service.findAll({ date, courtId, notified });
  }

  @Post(':id/notify')
  notifyEntry(@Param('id') id: string) {
    return this.service.notifyEntry(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

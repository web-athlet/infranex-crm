import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../shared/dto/authenticated-user.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ListActivitiesDto } from './dto/list-activities.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

function requireUserId(user: AuthenticatedUser | undefined): string {
  if (!user?.userId) {
    throw new UnauthorizedException('Missing authenticated user');
  }

  return user.userId;
}

@ApiTags('activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser | undefined, @Query() query: ListActivitiesDto) {
    return this.activitiesService.list(requireUserId(user), query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    return this.activitiesService.get(requireUserId(user), id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser | undefined, @Body() dto: CreateActivityDto) {
    return this.activitiesService.create(requireUserId(user), dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activitiesService.update(requireUserId(user), id, dto);
  }

  @Patch(':id/complete')
  complete(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    return this.activitiesService.complete(requireUserId(user), id);
  }

  @Patch(':id/reopen')
  reopen(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    return this.activitiesService.reopen(requireUserId(user), id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    return this.activitiesService.remove(requireUserId(user), id);
  }
}

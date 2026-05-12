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
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { ListDealsDto } from './dto/list-deals.dto';
import { UpdateDealDto } from './dto/update-deal.dto';

function requireUserId(user: AuthenticatedUser | undefined): string {
  if (!user?.userId) {
    throw new UnauthorizedException('Missing authenticated user');
  }

  return user.userId;
}

@ApiTags('deals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser | undefined, @Query() query: ListDealsDto) {
    return this.dealsService.list(requireUserId(user), query);
  }

  @Get('pipeline')
  pipeline(@CurrentUser() user: AuthenticatedUser | undefined) {
    return this.dealsService.getDefaultPipeline(requireUserId(user));
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    return this.dealsService.get(requireUserId(user), id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser | undefined, @Body() dto: CreateDealDto) {
    return this.dealsService.create(requireUserId(user), dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.dealsService.update(requireUserId(user), id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    return this.dealsService.remove(requireUserId(user), id);
  }
}

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
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { ListOrganizationsDto } from './dto/list-organizations.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

function requireUserId(user: AuthenticatedUser | undefined): string {
  if (!user?.userId) {
    throw new UnauthorizedException('Missing authenticated user');
  }

  return user.userId;
}

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser | undefined, @Query() query: ListOrganizationsDto) {
    return this.organizationsService.list(requireUserId(user), query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    return this.organizationsService.get(requireUserId(user), id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser | undefined, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(requireUserId(user), dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(requireUserId(user), id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    return this.organizationsService.remove(requireUserId(user), id);
  }
}

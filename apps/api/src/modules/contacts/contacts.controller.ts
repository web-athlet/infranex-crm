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
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { ListContactsDto } from './dto/list-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

function requireUserId(user: AuthenticatedUser | undefined): string {
  if (!user?.userId) {
    throw new UnauthorizedException('Missing authenticated user');
  }

  return user.userId;
}

@ApiTags('contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser | undefined, @Query() query: ListContactsDto) {
    return this.contactsService.list(requireUserId(user), query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    return this.contactsService.get(requireUserId(user), id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser | undefined, @Body() dto: CreateContactDto) {
    return this.contactsService.create(requireUserId(user), dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(requireUserId(user), id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    return this.contactsService.remove(requireUserId(user), id);
  }
}

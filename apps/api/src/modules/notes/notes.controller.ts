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
import { CreateNoteDto } from './dto/create-note.dto';
import { ListNotesDto } from './dto/list-notes.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { NotesService } from './notes.service';

function requireUserId(user: AuthenticatedUser | undefined): string {
  if (!user?.userId) {
    throw new UnauthorizedException('Missing authenticated user');
  }

  return user.userId;
}

@ApiTags('notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser | undefined, @Query() query: ListNotesDto) {
    return this.notesService.list(requireUserId(user), query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    return this.notesService.get(requireUserId(user), id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser | undefined, @Body() dto: CreateNoteDto) {
    return this.notesService.create(requireUserId(user), dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.update(requireUserId(user), id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    return this.notesService.remove(requireUserId(user), id);
  }
}

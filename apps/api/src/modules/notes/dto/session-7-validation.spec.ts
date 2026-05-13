import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

import { CreateNoteDto } from './create-note.dto';
import { ListNotesDto } from './list-notes.dto';
import { UpdateNoteDto } from './update-note.dto';

type DtoConstructor<T extends object> = new () => T;

const VALID_CUID = `c${'a'.repeat(24)}`;

async function validateDto<T extends object>(
  dto: DtoConstructor<T>,
  value: Record<string, unknown>,
  forbidExtra = false,
): Promise<{ instance: T; errors: ValidationError[]; properties: string[] }> {
  const instance = plainToInstance(dto, value);
  const errors = await validate(instance, {
    whitelist: forbidExtra,
    forbidNonWhitelisted: forbidExtra,
  });

  return {
    instance,
    errors,
    properties: errors.map((error) => error.property),
  };
}

test('Session 7 note DTOs reject empty content', async () => {
  const create = await validateDto(CreateNoteDto, { content: '   ' });
  const update = await validateDto(UpdateNoteDto, { content: '   ' });

  assert.ok(create.properties.includes('content'));
  assert.ok(update.properties.includes('content'));
});

test('Session 7 note DTOs reject invalid relation ids', async () => {
  const create = await validateDto(CreateNoteDto, {
    content: 'Note',
    organizationId: 'not-a-cuid',
    personId: 'not-a-cuid',
    dealId: 'not-a-cuid',
    activityId: 'not-a-cuid',
  });
  const list = await validateDto(ListNotesDto, {
    organizationId: 'not-a-cuid',
    personId: 'not-a-cuid',
    dealId: 'not-a-cuid',
    activityId: 'not-a-cuid',
  });

  assert.ok(create.properties.includes('organizationId'));
  assert.ok(create.properties.includes('personId'));
  assert.ok(create.properties.includes('dealId'));
  assert.ok(create.properties.includes('activityId'));
  assert.ok(list.properties.includes('organizationId'));
  assert.ok(list.properties.includes('personId'));
  assert.ok(list.properties.includes('dealId'));
  assert.ok(list.properties.includes('activityId'));
});

test('Session 7 note DTOs reject invalid type, page and limit values', async () => {
  const create = await validateDto(CreateNoteDto, {
    content: 'Note',
    type: 'not valid',
  });
  const list = await validateDto(ListNotesDto, {
    type: 'not valid',
    page: '0',
    limit: '101',
  });

  assert.ok(create.properties.includes('type'));
  assert.ok(list.properties.includes('type'));
  assert.ok(list.properties.includes('page'));
  assert.ok(list.properties.includes('limit'));
});

test('Session 7 note DTOs reject invalid nulls', async () => {
  const create = await validateDto(CreateNoteDto, {
    content: null,
    type: null,
  });
  const update = await validateDto(UpdateNoteDto, {
    content: null,
    type: null,
  });

  assert.ok(create.properties.includes('content'));
  assert.ok(create.properties.includes('type'));
  assert.ok(update.properties.includes('content'));
  assert.ok(update.properties.includes('type'));
});

test('Session 7 update DTO allows nullable detach fields', async () => {
  const update = await validateDto(UpdateNoteDto, {
    title: null,
    organizationId: null,
    personId: null,
    dealId: null,
    activityId: null,
  });

  assert.deepEqual(update.properties, []);
});

test('Session 7 note DTOs trim and normalize valid values', async () => {
  const create = await validateDto(CreateNoteDto, {
    title: ' Discovery ',
    content: ' Plain text ',
    type: ' comment ',
    organizationId: ` ${VALID_CUID} `,
    personId: ` ${VALID_CUID} `,
    dealId: ` ${VALID_CUID} `,
    activityId: ` ${VALID_CUID} `,
  });
  const list = await validateDto(ListNotesDto, {
    type: ' note ',
    page: '2',
    limit: '50',
  });

  assert.deepEqual(create.properties, []);
  assert.equal(create.instance.title, 'Discovery');
  assert.equal(create.instance.content, 'Plain text');
  assert.equal(create.instance.type, 'COMMENT');
  assert.equal(create.instance.organizationId, VALID_CUID);
  assert.equal(create.instance.personId, VALID_CUID);
  assert.equal(create.instance.dealId, VALID_CUID);
  assert.equal(create.instance.activityId, VALID_CUID);
  assert.deepEqual(list.properties, []);
  assert.equal(list.instance.type, 'NOTE');
  assert.equal(list.instance.page, 2);
  assert.equal(list.instance.limit, 50);
});

test('Session 7 note DTOs reject client-controlled server fields at the API boundary', async () => {
  const create = await validateDto(
    CreateNoteDto,
    {
      content: 'Note',
      tenantId: 'tenant-a',
      userId: 'user-a',
      ownerId: 'membership-a',
      authorId: 'membership-a',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    },
    true,
  );

  assert.ok(create.properties.includes('tenantId'));
  assert.ok(create.properties.includes('userId'));
  assert.ok(create.properties.includes('ownerId'));
  assert.ok(create.properties.includes('authorId'));
  assert.ok(create.properties.includes('createdAt'));
  assert.ok(create.properties.includes('updatedAt'));
  assert.ok(create.properties.includes('deletedAt'));
});

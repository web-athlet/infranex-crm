import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { ActivityType, Priority } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateActivityDto } from './create-activity.dto';
import {
  ActivityCompletionFilter,
  ActivityDueFilter,
  ListActivitiesDto,
} from './list-activities.dto';
import { UpdateActivityDto } from './update-activity.dto';

type DtoConstructor<T extends object> = new () => T;

const VALID_CUID = `c${'a'.repeat(24)}`;

async function validateDto<T extends object>(
  dto: DtoConstructor<T>,
  value: Record<string, unknown>,
): Promise<{ instance: T; properties: string[] }> {
  const instance = plainToInstance(dto, value);
  const errors = await validate(instance);

  return {
    instance,
    properties: errors.map((error) => error.property),
  };
}

test('Session 6 activity DTOs reject empty subjects', async () => {
  const create = await validateDto(CreateActivityDto, { subject: '   ' });
  const update = await validateDto(UpdateActivityDto, { subject: '   ' });

  assert.ok(create.properties.includes('subject'));
  assert.ok(update.properties.includes('subject'));
});

test('Session 6 activity DTOs reject invalid relation ids', async () => {
  const create = await validateDto(CreateActivityDto, {
    subject: 'Follow up',
    organizationId: 'not-a-cuid',
    personId: 'not-a-cuid',
    dealId: 'not-a-cuid',
  });
  const list = await validateDto(ListActivitiesDto, {
    organizationId: 'not-a-cuid',
    personId: 'not-a-cuid',
    dealId: 'not-a-cuid',
  });

  assert.ok(create.properties.includes('organizationId'));
  assert.ok(create.properties.includes('personId'));
  assert.ok(create.properties.includes('dealId'));
  assert.ok(list.properties.includes('organizationId'));
  assert.ok(list.properties.includes('personId'));
  assert.ok(list.properties.includes('dealId'));
});

test('Session 6 activity DTOs validate enums and dates', async () => {
  const create = await validateDto(CreateActivityDto, {
    subject: 'Follow up',
    type: 'VISIT',
    priority: 'CRITICAL',
    dueAt: 'not-a-date',
  });
  const list = await validateDto(ListActivitiesDto, {
    type: 'VISIT',
    priority: 'CRITICAL',
    completion: 'DONE',
    due: 'SOON',
  });

  assert.ok(create.properties.includes('type'));
  assert.ok(create.properties.includes('priority'));
  assert.ok(create.properties.includes('dueAt'));
  assert.ok(list.properties.includes('type'));
  assert.ok(list.properties.includes('priority'));
  assert.ok(list.properties.includes('completion'));
  assert.ok(list.properties.includes('due'));
});

test('Session 6 activity DTOs reject invalid nulls', async () => {
  const create = await validateDto(CreateActivityDto, {
    subject: null,
    type: null,
    priority: null,
  });
  const update = await validateDto(UpdateActivityDto, {
    subject: null,
    type: null,
    priority: null,
  });

  assert.ok(create.properties.includes('subject'));
  assert.ok(create.properties.includes('type'));
  assert.ok(create.properties.includes('priority'));
  assert.ok(update.properties.includes('subject'));
  assert.ok(update.properties.includes('type'));
  assert.ok(update.properties.includes('priority'));
});

test('Session 6 update DTO allows nullable detach fields', async () => {
  const update = await validateDto(UpdateActivityDto, {
    body: null,
    dueAt: null,
    organizationId: null,
    personId: null,
    dealId: null,
  });

  assert.deepEqual(update.properties, []);
});

test('Session 6 activity DTOs trim and normalize valid values', async () => {
  const create = await validateDto(CreateActivityDto, {
    subject: ' Follow up ',
    type: ActivityType.MEETING,
    priority: Priority.HIGH,
    dueAt: '2026-06-01T00:00:00.000Z',
    organizationId: ` ${VALID_CUID} `,
    personId: ` ${VALID_CUID} `,
    dealId: ` ${VALID_CUID} `,
  });
  const list = await validateDto(ListActivitiesDto, {
    type: ActivityType.TASK,
    priority: Priority.LOW,
    completion: ActivityCompletionFilter.OPEN,
    due: ActivityDueFilter.TODAY,
    page: '2',
    limit: '50',
  });

  assert.deepEqual(create.properties, []);
  assert.equal(create.instance.subject, 'Follow up');
  assert.equal(create.instance.organizationId, VALID_CUID);
  assert.equal(create.instance.personId, VALID_CUID);
  assert.equal(create.instance.dealId, VALID_CUID);
  assert.deepEqual(list.properties, []);
  assert.equal(list.instance.page, 2);
  assert.equal(list.instance.limit, 50);
});

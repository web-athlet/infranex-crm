import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { DealStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateDealDto } from './create-deal.dto';
import { ListDealsDto } from './list-deals.dto';
import { UpdateDealDto } from './update-deal.dto';

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

test('Session 5 deal DTOs reject empty titles', async () => {
  const create = await validateDto(CreateDealDto, { title: '   ' });
  const update = await validateDto(UpdateDealDto, { title: '   ' });

  assert.ok(create.properties.includes('title'));
  assert.ok(update.properties.includes('title'));
});

test('Session 5 deal DTOs reject invalid ids', async () => {
  const create = await validateDto(CreateDealDto, {
    title: 'Deal',
    stageId: 'not-a-cuid',
    organizationId: 'not-a-cuid',
    personId: 'not-a-cuid',
  });
  const list = await validateDto(ListDealsDto, { stageId: 'not-a-cuid' });

  assert.ok(create.properties.includes('stageId'));
  assert.ok(create.properties.includes('organizationId'));
  assert.ok(create.properties.includes('personId'));
  assert.ok(list.properties.includes('stageId'));
});

test('Session 5 deal DTOs validate status, currency, dates and value', async () => {
  const create = await validateDto(CreateDealDto, {
    title: 'Deal',
    status: 'PAUSED',
    currency: 'EURO',
    expectedCloseAt: 'not-a-date',
    value: -1,
  });
  const update = await validateDto(UpdateDealDto, {
    status: 'PAUSED',
    currency: 'EURO',
    expectedCloseAt: 'not-a-date',
    value: -1,
  });

  assert.ok(create.properties.includes('status'));
  assert.ok(create.properties.includes('currency'));
  assert.ok(create.properties.includes('expectedCloseAt'));
  assert.ok(create.properties.includes('value'));
  assert.ok(update.properties.includes('status'));
  assert.ok(update.properties.includes('currency'));
  assert.ok(update.properties.includes('expectedCloseAt'));
  assert.ok(update.properties.includes('value'));
});

test('Session 5 deal DTOs reject invalid nulls', async () => {
  const create = await validateDto(CreateDealDto, {
    title: null,
    value: null,
    currency: null,
    status: null,
    stageId: null,
  });
  const update = await validateDto(UpdateDealDto, {
    title: null,
    value: null,
    currency: null,
    status: null,
    stageId: null,
  });

  assert.ok(create.properties.includes('title'));
  assert.ok(create.properties.includes('value'));
  assert.ok(create.properties.includes('currency'));
  assert.ok(create.properties.includes('status'));
  assert.ok(create.properties.includes('stageId'));
  assert.ok(update.properties.includes('title'));
  assert.ok(update.properties.includes('value'));
  assert.ok(update.properties.includes('currency'));
  assert.ok(update.properties.includes('status'));
  assert.ok(update.properties.includes('stageId'));
});

test('Session 5 update DTO allows nullable detach fields', async () => {
  const update = await validateDto(UpdateDealDto, {
    description: null,
    organizationId: null,
    personId: null,
    expectedCloseAt: null,
    lostReason: null,
  });

  assert.deepEqual(update.properties, []);
});

test('Session 5 deal DTOs trim and normalize valid values', async () => {
  const create = await validateDto(CreateDealDto, {
    title: ' Deal ',
    currency: ' eur ',
    status: DealStatus.OPEN,
    stageId: ` ${VALID_CUID} `,
    organizationId: ` ${VALID_CUID} `,
    personId: ` ${VALID_CUID} `,
    expectedCloseAt: '2026-06-01T00:00:00.000Z',
    value: 100,
  });

  assert.deepEqual(create.properties, []);
  assert.equal(create.instance.title, 'Deal');
  assert.equal(create.instance.currency, 'EUR');
  assert.equal(create.instance.stageId, VALID_CUID);
  assert.equal(create.instance.organizationId, VALID_CUID);
  assert.equal(create.instance.personId, VALID_CUID);
});

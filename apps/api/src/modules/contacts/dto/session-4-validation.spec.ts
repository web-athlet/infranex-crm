import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateOrganizationDto } from '../../organizations/dto/create-organization.dto';
import { ListOrganizationsDto } from '../../organizations/dto/list-organizations.dto';
import { UpdateOrganizationDto } from '../../organizations/dto/update-organization.dto';
import { CreateContactDto } from './create-contact.dto';
import { ListContactsDto } from './list-contacts.dto';
import { UpdateContactDto } from './update-contact.dto';

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

test('Session 4 create DTOs reject whitespace-only required names', async () => {
  const contact = await validateDto(CreateContactDto, {
    firstName: '   ',
    lastName: 'Lovelace',
  });
  const organization = await validateDto(CreateOrganizationDto, {
    name: '   ',
  });

  assert.ok(contact.properties.includes('firstName'));
  assert.ok(organization.properties.includes('name'));
});

test('Session 4 update DTOs reject whitespace-only names when provided', async () => {
  const contact = await validateDto(UpdateContactDto, {
    firstName: '   ',
    lastName: '   ',
  });
  const organization = await validateDto(UpdateOrganizationDto, {
    name: '   ',
  });

  assert.ok(contact.properties.includes('firstName'));
  assert.ok(contact.properties.includes('lastName'));
  assert.ok(organization.properties.includes('name'));
});

test('Session 4 update DTOs reject null non-nullable contact fields', async () => {
  const nullFirstName = await validateDto(UpdateContactDto, {
    firstName: null,
  });
  const nullLastName = await validateDto(UpdateContactDto, {
    lastName: null,
  });
  const nullOptIn = await validateDto(UpdateContactDto, {
    optIn: null,
  });

  assert.ok(nullFirstName.properties.includes('firstName'));
  assert.ok(nullLastName.properties.includes('lastName'));
  assert.ok(nullOptIn.properties.includes('optIn'));
});

test('Session 4 update DTOs reject null non-nullable organization name', async () => {
  const organization = await validateDto(UpdateOrganizationDto, {
    name: null,
  });

  assert.ok(organization.properties.includes('name'));
});

test('Session 4 DTOs trim valid name fields before validation', async () => {
  const contact = await validateDto(CreateContactDto, {
    firstName: ' Ada ',
    lastName: ' Lovelace ',
  });
  const organization = await validateDto(CreateOrganizationDto, {
    name: ' Acme ',
  });

  assert.deepEqual(contact.properties, []);
  assert.deepEqual(organization.properties, []);
  assert.equal(contact.instance.firstName, 'Ada');
  assert.equal(contact.instance.lastName, 'Lovelace');
  assert.equal(organization.instance.name, 'Acme');
});

test('Session 4 contact DTOs allow null, undefined and valid CUID organizationId values', async () => {
  const createWithoutOrganization = await validateDto(CreateContactDto, {
    firstName: 'Ada',
    lastName: 'Lovelace',
  });
  const createWithNullOrganization = await validateDto(CreateContactDto, {
    firstName: 'Ada',
    lastName: 'Lovelace',
    organizationId: null,
  });
  const updateWithCuidOrganization = await validateDto(UpdateContactDto, {
    organizationId: ` ${VALID_CUID} `,
  });
  const listWithCuidOrganization = await validateDto(ListContactsDto, {
    organizationId: ` ${VALID_CUID} `,
  });

  assert.deepEqual(createWithoutOrganization.properties, []);
  assert.deepEqual(createWithNullOrganization.properties, []);
  assert.deepEqual(updateWithCuidOrganization.properties, []);
  assert.deepEqual(listWithCuidOrganization.properties, []);
  assert.equal(updateWithCuidOrganization.instance.organizationId, VALID_CUID);
  assert.equal(listWithCuidOrganization.instance.organizationId, VALID_CUID);
});

test('Session 4 update DTOs continue allowing null nullable fields', async () => {
  const contact = await validateDto(UpdateContactDto, {
    email: null,
    phone: null,
    title: null,
    organizationId: null,
    notes: null,
  });
  const organization = await validateDto(UpdateOrganizationDto, {
    website: null,
    domain: null,
    industry: null,
    notes: null,
  });

  assert.deepEqual(contact.properties, []);
  assert.deepEqual(organization.properties, []);
});

test('Session 4 contact DTOs reject invalid organizationId strings', async () => {
  const create = await validateDto(CreateContactDto, {
    firstName: 'Ada',
    lastName: 'Lovelace',
    organizationId: 'not-a-cuid',
  });
  const update = await validateDto(UpdateContactDto, {
    organizationId: '550e8400-e29b-41d4-a716-446655440000',
  });
  const list = await validateDto(ListContactsDto, {
    organizationId: 'not-a-cuid',
  });

  assert.ok(create.properties.includes('organizationId'));
  assert.ok(update.properties.includes('organizationId'));
  assert.ok(list.properties.includes('organizationId'));
});

test('Session 4 list DTOs continue rejecting non-numeric pagination values', async () => {
  const contacts = await validateDto(ListContactsDto, {
    page: 'abc',
    limit: 'def',
  });
  const organizations = await validateDto(ListOrganizationsDto, {
    page: 'abc',
    limit: 'def',
  });

  assert.ok(contacts.properties.includes('page'));
  assert.ok(contacts.properties.includes('limit'));
  assert.ok(organizations.properties.includes('page'));
  assert.ok(organizations.properties.includes('limit'));
});

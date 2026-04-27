import {
  AIInsightType,
  ActivityType,
  CampaignStatus,
  DealStatus,
  EnrichmentStatus,
  LeadStatus,
  MembershipRole,
  Prisma,
  PrismaClient,
  Priority,
  ProjectStatus,
  TaskStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_TENANT = {
  name: 'Infranex Demo',
  slug: 'infranex-demo',
} as const;

const DEMO_PASSWORD = 'Demo1234!';
const DEMO_PASSWORD_CHANGED_AT = new Date('2026-01-01T00:00:00.000Z');
const BASE_DATE = new Date('2026-01-15T09:00:00.000Z');

type DemoUser = {
  email: string;
  name: string;
  role: MembershipRole;
};

type SeedStats = {
  tenants: number;
  users: number;
  memberships: number;
  pipelines: number;
  stages: number;
  organizations: number;
  people: number;
  deals: number;
  activities: number;
  products: number;
  dealProducts: number;
  projects: number;
  tasks: number;
  projectTemplates: number;
  forms: number;
  leads: number;
  campaigns: number;
  campaignContacts: number;
  aiInsights: number;
};

const stats: SeedStats = {
  tenants: 0,
  users: 0,
  memberships: 0,
  pipelines: 0,
  stages: 0,
  organizations: 0,
  people: 0,
  deals: 0,
  activities: 0,
  products: 0,
  dealProducts: 0,
  projects: 0,
  tasks: 0,
  projectTemplates: 0,
  forms: 0,
  leads: 0,
  campaigns: 0,
  campaignContacts: 0,
  aiInsights: 0,
};

const demoUsers: DemoUser[] = [
  {
    email: 'admin@demo.de',
    name: 'Demo Admin',
    role: MembershipRole.ADMIN,
  },
  {
    email: 'manager@demo.de',
    name: 'Demo Manager',
    role: MembershipRole.MANAGER,
  },
  {
    email: 'sales@demo.de',
    name: 'Demo Sales',
    role: MembershipRole.SALES_REP,
  },
];

const stageNames = [
  'Qualifiziert',
  'Demo geplant',
  'Demo abgeschlossen',
  'Angebot abgegeben',
  'Verhandlungen',
  'Vertrag unterschrieben',
] as const;

const organizationData = Array.from({ length: 10 }, (_, index) => {
  const number = index + 1;

  return {
    name: `Demo Organisation ${number.toString().padStart(2, '0')}`,
    website: `https://demo-org-${number}.example`,
    domain: `demo-org-${number}.test`,
    industry: ['SaaS', 'Beratung', 'Industrie', 'Handel', 'Dienstleistung'][index % 5],
    notes: `Deterministische Demo-Organisation ${number}.`,
  };
});

const productData = [
  {
    name: 'Infranex CRM Starter',
    sku: 'INF-STARTER',
    description: 'Demo-Produkt fuer kleine Teams.',
    unitPrice: '49.00',
    isActive: true,
  },
  {
    name: 'Infranex CRM Growth',
    sku: 'INF-GROWTH',
    description: 'Demo-Produkt fuer wachsende Vertriebsteams.',
    unitPrice: '149.00',
    isActive: true,
  },
  {
    name: 'Infranex AI Add-on',
    sku: 'INF-AI',
    description: 'Demo-Add-on fuer AI-native CRM-Funktionen.',
    unitPrice: '299.00',
    isActive: true,
  },
  {
    name: 'Infranex Onboarding',
    sku: 'INF-ONBOARD',
    description: 'Demo-Dienstleistung fuer Implementierung.',
    unitPrice: '1200.00',
    isActive: true,
  },
  {
    name: 'Infranex Legacy Migration',
    sku: 'INF-MIGRATE',
    description: 'Demo-Dienstleistung fuer Datenmigration.',
    unitPrice: '2500.00',
    isActive: false,
  },
] as const;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function decimal(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

async function seedTenant() {
  stats.tenants += 1;

  return prisma.tenant.upsert({
    where: {
      slug: DEMO_TENANT.slug,
    },
    update: {
      name: DEMO_TENANT.name,
      deletedAt: null,
    },
    create: DEMO_TENANT,
  });
}

async function seedUsersAndMemberships(tenantId: string) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const memberships = [];

  for (const user of demoUsers) {
    const seededUser = await prisma.user.upsert({
      where: {
        email: user.email,
      },
      update: {
        name: user.name,
        passwordHash,
        passwordChangedAt: DEMO_PASSWORD_CHANGED_AT,
        deletedAt: null,
      },
      create: {
        email: user.email,
        name: user.name,
        passwordHash,
        passwordChangedAt: DEMO_PASSWORD_CHANGED_AT,
      },
    });

    const membership = await prisma.membership.upsert({
      where: {
        tenantId_userId: {
          tenantId,
          userId: seededUser.id,
        },
      },
      update: {
        role: user.role,
        isActive: true,
        joinedAt: BASE_DATE,
        deletedAt: null,
      },
      create: {
        tenantId,
        userId: seededUser.id,
        role: user.role,
        isActive: true,
        joinedAt: BASE_DATE,
      },
    });

    stats.users += 1;
    stats.memberships += 1;
    memberships.push(membership);
  }

  return memberships;
}

async function seedPipelineAndStages(tenantId: string) {
  const pipeline = await prisma.pipeline.upsert({
    where: {
      tenantId_name: {
        tenantId,
        name: 'Vertriebs-Pipeline',
      },
    },
    update: {
      isDefault: true,
      deletedAt: null,
    },
    create: {
      tenantId,
      name: 'Vertriebs-Pipeline',
      isDefault: true,
    },
  });

  stats.pipelines += 1;

  const stages = [];

  for (const [index, name] of stageNames.entries()) {
    const position = index + 1;
    const stage = await prisma.stage.upsert({
      where: {
        tenantId_pipelineId_name: {
          tenantId,
          pipelineId: pipeline.id,
          name,
        },
      },
      update: {
        position,
        probability: position * 15,
        deletedAt: null,
      },
      create: {
        tenantId,
        pipelineId: pipeline.id,
        name,
        position,
        probability: position * 15,
      },
    });

    stats.stages += 1;
    stages.push(stage);
  }

  return { pipeline, stages };
}

async function seedOrganizations(tenantId: string) {
  const organizations = [];

  for (const organization of organizationData) {
    const seededOrganization = await prisma.organization.upsert({
      where: {
        tenantId_domain: {
          tenantId,
          domain: organization.domain,
        },
      },
      update: {
        name: organization.name,
        website: organization.website,
        industry: organization.industry,
        notes: organization.notes,
        deletedAt: null,
      },
      create: {
        tenantId,
        ...organization,
      },
    });

    stats.organizations += 1;
    organizations.push(seededOrganization);
  }

  return organizations;
}

async function seedPeople(
  tenantId: string,
  organizations: Awaited<ReturnType<typeof seedOrganizations>>,
) {
  const people = [];

  for (let index = 0; index < 20; index += 1) {
    const number = index + 1;
    const organization = organizations[index % organizations.length];
    const email = `demo.person.${number}@${organization.domain ?? 'demo.example'}`;

    const person = await prisma.person.upsert({
      where: {
        tenantId_email: {
          tenantId,
          email,
        },
      },
      update: {
        organizationId: organization.id,
        firstName: `Demo`,
        lastName: `Kontakt ${number.toString().padStart(2, '0')}`,
        phone: `+49 30 0000 ${number.toString().padStart(4, '0')}`,
        title: ['CEO', 'Sales Lead', 'Operations', 'Marketing', 'IT'][index % 5],
        notes: `Deterministische Demo-Person ${number}.`,
        optIn: index % 3 !== 0,
        optInSource: index % 3 !== 0 ? 'demo-seed' : null,
        optInAt: index % 3 !== 0 ? addDays(BASE_DATE, index) : null,
        deletedAt: null,
      },
      create: {
        tenantId,
        organizationId: organization.id,
        firstName: 'Demo',
        lastName: `Kontakt ${number.toString().padStart(2, '0')}`,
        email,
        phone: `+49 30 0000 ${number.toString().padStart(4, '0')}`,
        title: ['CEO', 'Sales Lead', 'Operations', 'Marketing', 'IT'][index % 5],
        notes: `Deterministische Demo-Person ${number}.`,
        optIn: index % 3 !== 0,
        optInSource: index % 3 !== 0 ? 'demo-seed' : null,
        optInAt: index % 3 !== 0 ? addDays(BASE_DATE, index) : null,
      },
    });

    stats.people += 1;
    people.push(person);
  }

  return people;
}

async function upsertDealByTitle(data: Prisma.DealUncheckedCreateInput) {
  const existing = await prisma.deal.findFirst({
    where: {
      tenantId: data.tenantId,
      title: data.title,
    },
  });

  if (existing) {
    return prisma.deal.update({
      where: {
        id: existing.id,
      },
      data,
    });
  }

  return prisma.deal.create({
    data,
  });
}

async function seedDeals(
  tenantId: string,
  pipelineId: string,
  stages: Awaited<ReturnType<typeof seedPipelineAndStages>>['stages'],
  memberships: Awaited<ReturnType<typeof seedUsersAndMemberships>>,
  organizations: Awaited<ReturnType<typeof seedOrganizations>>,
  people: Awaited<ReturnType<typeof seedPeople>>,
) {
  const deals = [];

  for (let index = 0; index < 30; index += 1) {
    const number = index + 1;
    const stage = stages[index % stages.length];
    const organization = organizations[index % organizations.length];
    const person = people[index % people.length];
    const owner = memberships[index % memberships.length];
    const status = index > 24 ? DealStatus.LOST : index > 20 ? DealStatus.WON : DealStatus.OPEN;

    const deal = await upsertDealByTitle({
      tenantId,
      organizationId: organization.id,
      personId: person.id,
      pipelineId,
      stageId: stage.id,
      ownerId: owner.id,
      title: `Demo Deal ${number.toString().padStart(2, '0')}`,
      description: `Deterministischer Demo-Deal ${number}.`,
      value: decimal(5000 + number * 750),
      currency: 'EUR',
      status,
      expectedCloseAt: status === DealStatus.OPEN ? addDays(BASE_DATE, number * 3) : null,
      closedAt: status === DealStatus.OPEN ? null : addDays(BASE_DATE, number),
      lostReason: status === DealStatus.LOST ? 'Demo Lost Reason' : null,
      ghostingSnoozedUntil:
        status === DealStatus.OPEN && index % 5 === 0 ? addDays(BASE_DATE, number * 2) : null,
      deletedAt: null,
    });

    stats.deals += 1;
    deals.push(deal);
  }

  return deals;
}

async function upsertActivityBySubject(data: Prisma.ActivityUncheckedCreateInput) {
  const existing = await prisma.activity.findFirst({
    where: {
      tenantId: data.tenantId,
      subject: data.subject,
    },
  });

  if (existing) {
    return prisma.activity.update({
      where: {
        id: existing.id,
      },
      data,
    });
  }

  return prisma.activity.create({
    data,
  });
}

async function seedActivities(
  tenantId: string,
  memberships: Awaited<ReturnType<typeof seedUsersAndMemberships>>,
  organizations: Awaited<ReturnType<typeof seedOrganizations>>,
  people: Awaited<ReturnType<typeof seedPeople>>,
  deals: Awaited<ReturnType<typeof seedDeals>>,
) {
  const activityTypes = [
    ActivityType.CALL,
    ActivityType.EMAIL,
    ActivityType.MEETING,
    ActivityType.TASK,
    ActivityType.NOTE,
  ];

  for (let index = 0; index < 50; index += 1) {
    const number = index + 1;
    const deal = deals[index % deals.length];
    const person = people[index % people.length];
    const organization = organizations[index % organizations.length];
    const owner = memberships[index % memberships.length];
    const completedAt = index % 4 === 0 ? addDays(BASE_DATE, index) : null;

    await upsertActivityBySubject({
      tenantId,
      organizationId: organization.id,
      personId: person.id,
      dealId: deal.id,
      ownerId: index % 7 === 0 ? null : owner.id,
      type: activityTypes[index % activityTypes.length],
      priority: [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.URGENT][index % 4],
      subject: `Demo Aktivitaet ${number.toString().padStart(2, '0')}`,
      body: `Deterministische Demo-Aktivitaet ${number}.`,
      dueAt: completedAt ? null : addDays(BASE_DATE, number),
      completedAt,
      deletedAt: null,
    });

    stats.activities += 1;
  }
}

async function seedProducts(tenantId: string) {
  const products = [];

  for (const product of productData) {
    const seededProduct = await prisma.product.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: product.name,
        },
      },
      update: {
        sku: product.sku,
        description: product.description,
        unitPrice: decimal(product.unitPrice),
        currency: 'EUR',
        isActive: product.isActive,
        deletedAt: null,
      },
      create: {
        tenantId,
        name: product.name,
        sku: product.sku,
        description: product.description,
        unitPrice: decimal(product.unitPrice),
        currency: 'EUR',
        isActive: product.isActive,
      },
    });

    stats.products += 1;
    products.push(seededProduct);
  }

  return products;
}

async function seedDealProducts(
  tenantId: string,
  deals: Awaited<ReturnType<typeof seedDeals>>,
  products: Awaited<ReturnType<typeof seedProducts>>,
) {
  for (let index = 0; index < 18; index += 1) {
    const deal = deals[index % deals.length];
    const product = products[index % products.length];
    const quantity = decimal((index % 4) + 1);
    const unitPrice = product.unitPrice ?? decimal(100);
    const totalPrice = unitPrice.mul(quantity);

    await prisma.dealProduct.upsert({
      where: {
        tenantId_dealId_productId: {
          tenantId,
          dealId: deal.id,
          productId: product.id,
        },
      },
      update: {
        quantity,
        unitPrice,
        totalPrice,
        currency: 'EUR',
      },
      create: {
        tenantId,
        dealId: deal.id,
        productId: product.id,
        quantity,
        unitPrice,
        totalPrice,
        currency: 'EUR',
      },
    });

    stats.dealProducts += 1;
  }
}

async function upsertProjectByName(data: Prisma.ProjectUncheckedCreateInput) {
  const existing = await prisma.project.findFirst({
    where: {
      tenantId: data.tenantId,
      name: data.name,
    },
  });

  if (existing) {
    return prisma.project.update({
      where: {
        id: existing.id,
      },
      data,
    });
  }

  return prisma.project.create({
    data,
  });
}

async function seedProjectsAndTasks(
  tenantId: string,
  memberships: Awaited<ReturnType<typeof seedUsersAndMemberships>>,
  organizations: Awaited<ReturnType<typeof seedOrganizations>>,
  deals: Awaited<ReturnType<typeof seedDeals>>,
) {
  const projects = [];

  for (let index = 0; index < 3; index += 1) {
    const number = index + 1;
    const project = await upsertProjectByName({
      tenantId,
      organizationId: organizations[index].id,
      dealId: deals[index].id,
      name: `Demo Kundenprojekt ${number}`,
      description: `Deterministisches Demo-Projekt ${number}.`,
      status: [ProjectStatus.PLANNED, ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD][index],
      startsAt: addDays(BASE_DATE, index * 7),
      endsAt: addDays(BASE_DATE, 45 + index * 14),
      deletedAt: null,
    });

    stats.projects += 1;
    projects.push(project);

    for (let taskIndex = 0; taskIndex < 4; taskIndex += 1) {
      const owner = memberships[(index + taskIndex) % memberships.length];
      const title = `Demo Projekt ${number} Aufgabe ${taskIndex + 1}`;
      const existingTask = await prisma.task.findFirst({
        where: {
          tenantId,
          projectId: project.id,
          title,
        },
      });

      const data: Prisma.TaskUncheckedCreateInput = {
        tenantId,
        projectId: project.id,
        ownerId: taskIndex === 3 ? null : owner.id,
        title,
        description: `Deterministische Demo-Aufgabe ${taskIndex + 1}.`,
        status: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE, TaskStatus.BLOCKED][
          taskIndex
        ],
        priority: [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.URGENT][taskIndex],
        dueAt: addDays(BASE_DATE, 5 + index * 7 + taskIndex),
        completedAt: taskIndex === 2 ? addDays(BASE_DATE, 7 + index * 7) : null,
        deletedAt: null,
      };

      if (existingTask) {
        await prisma.task.update({
          where: {
            id: existingTask.id,
          },
          data,
        });
      } else {
        await prisma.task.create({
          data,
        });
      }

      stats.tasks += 1;
    }
  }

  return projects;
}

async function seedProjectTemplate(tenantId: string) {
  const template: Prisma.InputJsonObject = {
    phases: [
      {
        name: 'Kickoff',
        tasks: ['Stakeholder abstimmen', 'Projektplan bestaetigen'],
      },
      {
        name: 'Implementierung',
        tasks: ['CRM Datenmodell pruefen', 'Demo Workflows konfigurieren'],
      },
      {
        name: 'Abnahme',
        tasks: ['Testdaten pruefen', 'Go-live Checkliste bestaetigen'],
      },
    ],
  };

  await prisma.projectTemplate.upsert({
    where: {
      tenantId_name: {
        tenantId,
        name: 'Kundenprojekt Standard',
      },
    },
    update: {
      description: 'Deterministisches Demo-Template ohne Secrets.',
      template,
      isActive: true,
      deletedAt: null,
    },
    create: {
      tenantId,
      name: 'Kundenprojekt Standard',
      description: 'Deterministisches Demo-Template ohne Secrets.',
      template,
      isActive: true,
    },
  });

  stats.projectTemplates += 1;
}

async function seedFormsLeadsCampaignsAndInsights(
  tenantId: string,
  organizations: Awaited<ReturnType<typeof seedOrganizations>>,
  people: Awaited<ReturnType<typeof seedPeople>>,
  deals: Awaited<ReturnType<typeof seedDeals>>,
) {
  const form = await prisma.form.upsert({
    where: {
      tenantId_slug: {
        tenantId,
        slug: 'demo-kontaktformular',
      },
    },
    update: {
      name: 'Demo Kontaktformular',
      description: 'Lokales Demo-Formular fuer Seed-Daten.',
      isActive: true,
      deletedAt: null,
    },
    create: {
      tenantId,
      name: 'Demo Kontaktformular',
      slug: 'demo-kontaktformular',
      description: 'Lokales Demo-Formular fuer Seed-Daten.',
      isActive: true,
    },
  });

  stats.forms += 1;

  for (let index = 0; index < 6; index += 1) {
    const source = `demo-lead-${index + 1}`;
    const existingLead = await prisma.lead.findFirst({
      where: {
        tenantId,
        source,
      },
    });

    const data: Prisma.LeadUncheckedCreateInput = {
      tenantId,
      formId: form.id,
      organizationId: organizations[index % organizations.length].id,
      personId: people[index % people.length].id,
      source,
      status: [LeadStatus.NEW, LeadStatus.QUALIFIED, LeadStatus.DISQUALIFIED, LeadStatus.CONVERTED][
        index % 4
      ],
      enrichmentStatus: [
        EnrichmentStatus.PENDING,
        EnrichmentStatus.IN_PROGRESS,
        EnrichmentStatus.COMPLETED,
        EnrichmentStatus.FAILED,
      ][index % 4],
      rawPayload: {
        demo: true,
        source,
      },
      deletedAt: null,
    };

    if (existingLead) {
      await prisma.lead.update({
        where: {
          id: existingLead.id,
        },
        data,
      });
    } else {
      await prisma.lead.create({
        data,
      });
    }

    stats.leads += 1;
  }

  const campaign = await prisma.campaign.upsert({
    where: {
      tenantId_name: {
        tenantId,
        name: 'Demo Reaktivierungskampagne',
      },
    },
    update: {
      status: CampaignStatus.DRAFT,
      subject: 'Demo Kampagne',
      bodyEncrypted: 'demo-encrypted-campaign-body-placeholder:v1',
      bodyPreview: 'Kurze Demo-Vorschau fuer lokale Entwicklung.',
      scheduledAt: addDays(BASE_DATE, 14),
      deletedAt: null,
    },
    create: {
      tenantId,
      name: 'Demo Reaktivierungskampagne',
      status: CampaignStatus.DRAFT,
      subject: 'Demo Kampagne',
      bodyEncrypted: 'demo-encrypted-campaign-body-placeholder:v1',
      bodyPreview: 'Kurze Demo-Vorschau fuer lokale Entwicklung.',
      scheduledAt: addDays(BASE_DATE, 14),
    },
  });

  stats.campaigns += 1;

  for (let index = 0; index < 5; index += 1) {
    await prisma.campaignContact.upsert({
      where: {
        trackingToken: `demo-tracking-token-${index + 1}`,
      },
      update: {
        tenantId,
        campaignId: campaign.id,
        personId: people[index].id,
        sentAt: addDays(BASE_DATE, index),
        openedAt: index % 2 === 0 ? addDays(BASE_DATE, index + 1) : null,
        clickedAt: index === 2 ? addDays(BASE_DATE, index + 2) : null,
        unsubscribedAt: null,
      },
      create: {
        tenantId,
        campaignId: campaign.id,
        personId: people[index].id,
        trackingToken: `demo-tracking-token-${index + 1}`,
        sentAt: addDays(BASE_DATE, index),
        openedAt: index % 2 === 0 ? addDays(BASE_DATE, index + 1) : null,
        clickedAt: index === 2 ? addDays(BASE_DATE, index + 2) : null,
        unsubscribedAt: null,
      },
    });

    stats.campaignContacts += 1;
  }

  for (let index = 0; index < 5; index += 1) {
    const type = [
      AIInsightType.SUMMARY,
      AIInsightType.NEXT_ACTION,
      AIInsightType.RISK,
      AIInsightType.OPPORTUNITY,
      AIInsightType.ENRICHMENT,
    ][index];
    const title = `Demo AI Insight ${index + 1}`;
    const existingInsight = await prisma.aIInsight.findFirst({
      where: {
        tenantId,
        type,
        title,
      },
    });
    const data: Prisma.AIInsightUncheckedCreateInput = {
      tenantId,
      organizationId: organizations[index % organizations.length].id,
      personId: people[index % people.length].id,
      dealId: deals[index % deals.length].id,
      type,
      title,
      content: {
        demo: true,
        summary: `Deterministischer Demo Insight ${index + 1}.`,
      },
      confidence: decimal(`0.${7 + index}`),
      validatedAt: index % 2 === 0 ? addDays(BASE_DATE, index) : null,
      dismissedAt: null,
      deletedAt: null,
    };

    if (existingInsight) {
      await prisma.aIInsight.update({
        where: {
          id: existingInsight.id,
        },
        data,
      });
    } else {
      await prisma.aIInsight.create({
        data,
      });
    }

    stats.aiInsights += 1;
  }
}

async function main() {
  const tenant = await seedTenant();
  const memberships = await seedUsersAndMemberships(tenant.id);
  const { pipeline, stages } = await seedPipelineAndStages(tenant.id);
  const organizations = await seedOrganizations(tenant.id);
  const people = await seedPeople(tenant.id, organizations);
  const deals = await seedDeals(tenant.id, pipeline.id, stages, memberships, organizations, people);

  await seedActivities(tenant.id, memberships, organizations, people, deals);

  const products = await seedProducts(tenant.id);
  await seedDealProducts(tenant.id, deals, products);

  await seedProjectsAndTasks(tenant.id, memberships, organizations, deals);
  await seedProjectTemplate(tenant.id);
  await seedFormsLeadsCampaignsAndInsights(tenant.id, organizations, people, deals);

  console.info('Infranex demo seed completed.', stats);
}

main()
  .catch((error: unknown) => {
    console.error('Infranex demo seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

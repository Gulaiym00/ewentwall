// Seeds the database.
//   npm run db:seed          → first admin (ADMIN_EMAIL / ADMIN_PASSWORD), default content & settings
//   npm run db:seed -- --demo → plus a demo organizer with events and landing-page reviews
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';
import { DEFAULT_CONTENT } from '../src/platform/content.service.js';
import { DEFAULT_SETTINGS } from '../src/platform/settings.service.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! }) });
const hash = (p: string) => argon2.hash(p, { type: argon2.argon2id });
const json = (v: unknown) => v as Prisma.InputJsonValue;

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12 || password === 'change-me-please') {
    throw new Error('Set ADMIN_EMAIL and a strong ADMIN_PASSWORD (12+ characters) in .env before seeding');
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && process.env.ADMIN_RESET_PASSWORD === 'true') {
    // Forgotten admin password: set ADMIN_RESET_PASSWORD=true once, restart, then remove it.
    await prisma.user.update({ where: { email }, data: { role: 'ADMIN', status: 'ACTIVE', passwordHash: await hash(password) } });
    await prisma.refreshToken.updateMany({ where: { userId: existing.id, revokedAt: null }, data: { revokedAt: new Date() } });
    console.log(`✓ Admin ${email} password reset from ADMIN_PASSWORD — remove ADMIN_RESET_PASSWORD now`);
  } else if (existing) {
    // Never overwrite an existing password; only make sure the account is an active admin.
    await prisma.user.update({ where: { email }, data: { role: 'ADMIN', status: 'ACTIVE' } });
    console.log(`✓ Admin ${email} already exists (role ensured)`);
  } else {
    await prisma.user.create({ data: { email, name: 'Admin', passwordHash: await hash(password), role: 'ADMIN' } });
    console.log(`✓ Admin created: ${email} (password from ADMIN_PASSWORD)`);
  }
}

async function seedDefaults() {
  for (const locale of ['EN', 'RU'] as const) {
    await prisma.siteContent.upsert({ where: { locale }, create: { locale, data: json(DEFAULT_CONTENT[locale]) }, update: {} });
  }
  await prisma.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, data: json(DEFAULT_SETTINGS) }, update: {} });
  console.log('✓ Default landing content and platform settings');
}

async function seedDemo() {
  const email = 'anna@example.com';
  if (await prisma.user.findUnique({ where: { email } })) {
    console.log('• Demo data already present, skipped');
    return;
  }
  const password = randomBytes(9).toString('base64url');
  const anna = await prisma.user.create({ data: { email, name: 'Anna Ivanova', passwordHash: await hash(password), city: 'Bishkek' } });
  const suffix = () => randomBytes(3).toString('hex');
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);

  const wedding = await prisma.event.create({
    data: { organizerId: anna.id, slug: `anna-timur-wedding-${suffix()}`, name: 'Anna & Timur Wedding', type: 'Wedding', location: 'Bishkek', startsAt: day(0), status: 'ACTIVE', welcomeMessage: 'Welcome! Share your photos from today’s celebration.' },
  });
  await prisma.event.createMany({
    data: [
      { organizerId: anna.id, slug: `sabinas-30th-birthday-${suffix()}`, name: "Sabina's 30th Birthday", type: 'Birthday', location: 'Almaty', startsAt: day(18), status: 'UPCOMING' },
      { organizerId: anna.id, slug: `techconf-annual-2026-${suffix()}`, name: 'TechConf Annual 2026', type: 'Corporate', location: 'Tashkent', startsAt: day(-40), status: 'CLOSED' },
      { organizerId: anna.id, slug: `leila-aibek-engagement-${suffix()}`, name: 'Leila & Aibek Engagement', type: 'Anniversary', location: 'Bishkek', startsAt: day(42), status: 'UPCOMING' },
    ],
  });

  // The three reviews shown on the landing page
  const authors = [
    { name: 'Алина М.', email: 'alina@example.com', text: 'Наши гости были в восторге! За вечер загрузили больше 800 фотографий. Это было как живой фотоальбом в реальном времени.' },
    { name: 'Mikhail R.', email: 'mikhail@example.com', text: 'We used it for our company anniversary and it was a huge hit. The live wall on the big screen made the event so much more engaging.' },
    { name: 'Сабина К.', email: 'sabina@example.com', text: 'Просто отсканировали QR — и всё. Никакой регистрации, никаких приложений. Гости сразу начали загружать фото.' },
  ];
  for (const a of authors) {
    const user = await prisma.user.create({ data: { email: a.email, name: a.name } });
    await prisma.review.create({ data: { organizerId: user.id, rating: 5, text: a.text, status: 'PUBLISHED', featured: true } });
  }
  await prisma.review.create({ data: { organizerId: anna.id, eventId: wedding.id, rating: 4, text: 'Very easy for guests. Would love a PDF album export!', status: 'PENDING' } });

  console.log(`✓ Demo organizer: ${email} / ${password}`);
  console.log(`  Guest link for the active event: /e/${wedding.slug}`);
}

try {
  await seedAdmin();
  await seedDefaults();
  if (process.argv.includes('--demo')) await seedDemo();
} finally {
  await prisma.$disconnect();
}

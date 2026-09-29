import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/main.js';

// End-to-end tests against a real database. They create uniquely named users and
// events and never delete existing data, but still refuse to run against a remote DB.
const dbUrl = process.env.DATABASE_URL ?? '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl)) {
  throw new Error('e2e tests only run against a local database (npm run db:local). DATABASE_URL points elsewhere.');
}

// 1×1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

let app: NestExpressApplication;
let http: ReturnType<NestExpressApplication['getHttpServer']>;
const run = Date.now().toString(36);
const api = () => request(http);

async function register(name: string) {
  const res = await api().post('/api/auth/register')
    .send({ name, email: `${name.toLowerCase().replace(/\W/g, '')}.${run}@example.com`, password: 'super-secret-1' })
    .expect(201);
  return res.body as { accessToken: string; refreshToken: string; user: { id: string; email: string } };
}

async function adminToken() {
  const res = await api().post('/api/auth/login')
    .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    .expect(200);
  return res.body.accessToken as string;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  http = app.getHttpServer();
});

afterAll(async () => {
  await app?.close();
});

describe('auth', () => {
  it('registers, rotates refresh tokens and detects reuse', async () => {
    const { accessToken, refreshToken } = await register('Rotation');
    await api().get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);

    const rotated = await api().post('/api/auth/refresh').send({ refreshToken }).expect(200);
    // Reusing the old token is treated as theft: it fails and kills the new one too.
    await api().post('/api/auth/refresh').send({ refreshToken }).expect(401);
    await api().post('/api/auth/refresh').send({ refreshToken: rotated.body.refreshToken }).expect(401);
  });

  it('rejects unknown fields (no self-assigned admin role)', async () => {
    await api().post('/api/auth/register')
      .send({ name: 'Sneaky', email: `sneaky.${run}@example.com`, password: 'super-secret-1', role: 'ADMIN' })
      .expect(400);
  });

  it('requires a token for private routes', async () => {
    await api().get('/api/events').expect(401);
  });
});

describe('organizer → guest → admin flow', () => {
  let org: Awaited<ReturnType<typeof register>>;
  let eventId: string;
  let slug: string;
  let guestToken: string;
  let photoId: string;

  it('organizer creates a PIN-protected event and gets a real QR code', async () => {
    org = await register('Organizer');
    const res = await api().post('/api/events').set('Authorization', `Bearer ${org.accessToken}`)
      .send({ name: 'Свадьба Анны', type: 'Wedding', location: 'Bishkek', pin: '2468' })
      .expect(201);
    eventId = res.body.id;
    slug = res.body.slug;
    expect(slug).toMatch(/^svadba-anny-[0-9a-f]{6}$/);
    expect(res.body.settings.pinRequired).toBe(true);
    expect(res.body.status).toBe('active');

    const qr = await api().get(`/api/events/${eventId}/qr`).set('Authorization', `Bearer ${org.accessToken}`).expect(200);
    expect(qr.headers['content-type']).toContain('image/png');
  });

  it('another organizer cannot touch the event', async () => {
    const other = await register('Other');
    await api().patch(`/api/events/${eventId}`).set('Authorization', `Bearer ${other.accessToken}`).send({ name: 'Mine now' }).expect(403);
  });

  it('guest needs the right PIN, then uploads a photo', async () => {
    const pub = await api().get(`/api/e/${slug}`).expect(200);
    expect(pub.body).not.toHaveProperty('pinHash');
    expect(pub.body.settings.pinRequired).toBe(true);

    // A PIN makes the event private: no photo feed without joining.
    await api().get(`/api/e/${slug}/photos`).expect(401);
    await api().post(`/api/e/${slug}/join`).send({ name: 'Aigerim', pin: '0000' }).expect(401);
    const joined = await api().post(`/api/e/${slug}/join`).send({ name: 'Aigerim', pin: '2468' }).expect(201);
    guestToken = joined.body.guestToken;

    await api().post(`/api/e/${slug}/photos`).set('Authorization', `Bearer ${guestToken}`)
      .attach('files', Buffer.from('not an image'), 'fake.jpg').expect(400);

    const up = await api().post(`/api/e/${slug}/photos`).set('Authorization', `Bearer ${guestToken}`)
      .field('caption', 'First!').attach('files', PNG, 'pixel.png').expect(201);
    expect(up.body.awaitingApproval).toBe(false);
    photoId = up.body.photos[0].id;

    // The file is actually served
    const url = new URL(up.body.photos[0].url);
    await api().get(url.pathname).expect(200).expect('Content-Type', /image\/png/);
  });

  it('guest reacts (toggle) and comments with profanity masked', async () => {
    const auth = { Authorization: `Bearer ${guestToken}` };
    const r1 = await api().post(`/api/photos/${photoId}/reactions`).set(auth).send({ emoji: '🔥' }).expect(200);
    expect(r1.body.myReaction).toBe('🔥');
    const r2 = await api().post(`/api/photos/${photoId}/reactions`).set(auth).send({ emoji: '🔥' }).expect(200);
    expect(r2.body.myReaction).toBeNull();

    const c = await api().post(`/api/photos/${photoId}/comments`).set(auth).send({ text: 'what the fuck, beautiful!' }).expect(201);
    expect(c.body.text).toBe('what the f***, beautiful!');

    const feed = await api().get(`/api/e/${slug}/photos`).set(auth).expect(200);
    expect(feed.body.items.map((p: { id: string }) => p.id)).toContain(photoId);
    expect(feed.body.items[0].commentCount).toBe(1);
  });

  it('organizers cannot open the admin API', async () => {
    await api().get('/api/admin/stats').set('Authorization', `Bearer ${org.accessToken}`).expect(403);
  });

  it('a report reaches the admin, who removes the photo; the action is audited', async () => {
    await api().post(`/api/photos/${photoId}/reports`).set('Authorization', `Bearer ${guestToken}`).send({ reason: 'spam' }).expect(201);
    await api().post(`/api/photos/${photoId}/reports`).set('Authorization', `Bearer ${guestToken}`).send({ reason: 'spam' }).expect(409);

    const token = await adminToken();
    const admin = { Authorization: `Bearer ${token}` };
    const queue = await api().get('/api/admin/reports?status=pending').set(admin).expect(200);
    expect(queue.body.items.some((i: { photoId: string }) => i.photoId === photoId)).toBe(true);

    await api().post('/api/admin/reports/resolve').set(admin).send({ photoIds: [photoId], action: 'remove' }).expect(200);
    const feed = await api().get(`/api/e/${slug}/photos`).set('Authorization', `Bearer ${guestToken}`).expect(200);
    expect(feed.body.items.map((p: { id: string }) => p.id)).not.toContain(photoId);

    const audit = await api().get('/api/admin/audit?category=moderation').set(admin).expect(200);
    expect(audit.body.items[0].action).toBe('Removed photo');
  });

  it('blocking a user locks them out immediately', async () => {
    const victim = await register('Blocked');
    const admin = { Authorization: `Bearer ${await adminToken()}` };
    await api().patch(`/api/admin/users/${victim.user.id}`).set(admin).send({ status: 'blocked' }).expect(200);
    await api().get('/api/auth/me').set('Authorization', `Bearer ${victim.accessToken}`).expect(403);
    await api().post('/api/auth/refresh').send({ refreshToken: victim.refreshToken }).expect(401);
  });
});

describe('premoderation', () => {
  it('holds photos until the organizer approves them', async () => {
    const org = await register('Moderator');
    const auth = { Authorization: `Bearer ${org.accessToken}` };
    const ev = await api().post('/api/events').set(auth).send({ name: 'Private party', premoderation: true }).expect(201);
    const { guestToken } = (await api().post(`/api/e/${ev.body.slug}/join`).send({}).expect(201)).body;

    const up = await api().post(`/api/e/${ev.body.slug}/photos`).set('Authorization', `Bearer ${guestToken}`)
      .attach('files', PNG, 'p.png').expect(201);
    expect(up.body.awaitingApproval).toBe(true);
    const id = up.body.photos[0].id;

    expect((await api().get(`/api/e/${ev.body.slug}/photos`).expect(200)).body.items).toHaveLength(0);
    const pending = await api().get(`/api/events/${ev.body.id}/photos?status=pending`).set(auth).expect(200);
    expect(pending.body.map((p: { id: string }) => p.id)).toEqual([id]);

    await api().patch(`/api/events/${ev.body.id}/photos/${id}`).set(auth).send({ status: 'published' }).expect(200);
    expect((await api().get(`/api/e/${ev.body.slug}/photos`).expect(200)).body.items).toHaveLength(1);
  });
});

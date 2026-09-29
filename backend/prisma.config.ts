import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// The CLI (migrate, db push, studio) talks to the database directly.
// On Supabase that is the "Direct connection" (port 5432), not the pooler (6543).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --import tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
    shadowDatabaseUrl: process.env['SHADOW_DATABASE_URL'],
  },
});

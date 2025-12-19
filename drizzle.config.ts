import { config } from 'dotenv';
import type { Config } from 'drizzle-kit';

// Load environment variables from .env.local
config({ path: '.env.local' });

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;

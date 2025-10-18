import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

if (!process.env.VITE_SUPABASE_URL) {
  throw new Error('VITE_SUPABASE_URL must be set');
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
const connectionString = `postgresql://postgres:postgres@db.${projectRef}.supabase.co:5432/postgres`;

const client = postgres(connectionString, {
  prepare: false,
});

export const db = drizzle(client, { schema });

/*
  # Email Classification System - Complete Database Schema

  ## Overview
  Creates the complete database structure for an AI-powered email classification system
  that uses OpenAI embeddings and vector similarity for intelligent email organization.

  ## New Tables

  ### 1. users
  User authentication and account management
  - `id` (uuid, primary key) - Unique user identifier
  - `email` (text, unique, not null) - User email address for login
  - `password` (text, not null) - Hashed password
  - `created_at` (timestamptz) - Account creation timestamp

  ### 2. categories
  Email classification categories with visual customization
  - `id` (uuid, primary key) - Unique category identifier
  - `user_id` (uuid, foreign key) - Owner of the category
  - `name` (text, not null) - Category name (unique per user)
  - `description` (text) - Category description
  - `color` (text, not null) - Hex color code for UI display
  - `icon` (text, not null) - Icon name from lucide-react
  - `created_at` (timestamptz) - Creation timestamp

  ### 3. emails
  Emails synced from Gmail with AI embeddings
  - `id` (uuid, primary key) - Unique email identifier
  - `user_id` (uuid, foreign key) - Email owner
  - `gmail_id` (text, unique, not null) - Gmail message ID
  - `subject` (text, not null) - Email subject line
  - `from_email` (text, not null) - Sender email address
  - `to_email` (text, not null) - Recipient email address
  - `body` (text) - Full email body content
  - `snippet` (text) - Short email preview
  - `received_at` (timestamptz, not null) - Email received timestamp
  - `embedding` (vector(1536)) - OpenAI text-embedding-3-small vector
  - `is_archived` (boolean) - Archive status for bulk actions
  - `created_at` (timestamptz) - Record creation timestamp

  ### 4. classifications
  Links emails to categories with confidence scores
  - `id` (uuid, primary key) - Unique classification identifier
  - `email_id` (uuid, foreign key) - Classified email
  - `category_id` (uuid, foreign key) - Assigned category
  - `confidence` (real, not null) - AI confidence score (0-1)
  - `is_manual` (boolean, not null) - Manual override flag
  - `created_at` (timestamptz) - Classification timestamp

  ## Security

  ### Row Level Security (RLS)
  All tables have RLS enabled with policies ensuring users can only access their own data.

  ### Policies Created
  - Users can view and update their own profile
  - Users can manage their own categories (CRUD)
  - Users can view and manage their own emails
  - Users can manage classifications for their own emails
  - No public access - all data is user-scoped

  ## Indexes
  - Emails: Indexed on gmail_id, user_id, received_at for fast queries
  - Categories: Indexed on user_id and name
  - Classifications: Indexed on email_id and category_id
  - Vector index on embeddings for similarity search (using HNSW)

  ## Extensions
  - pgcrypto: For UUID generation
  - vector: For AI embeddings storage and similarity search
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#3b82f6',
  icon text NOT NULL DEFAULT 'Folder',
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, name)
);

-- Emails table
CREATE TABLE IF NOT EXISTS emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gmail_id text UNIQUE NOT NULL,
  subject text NOT NULL DEFAULT '(No Subject)',
  from_email text NOT NULL,
  to_email text NOT NULL,
  body text,
  snippet text,
  received_at timestamptz NOT NULL DEFAULT now(),
  embedding vector(1536),
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Classifications table
CREATE TABLE IF NOT EXISTS classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  confidence real NOT NULL DEFAULT 0.5,
  is_manual boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(email_id, category_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_gmail_id ON emails(gmail_id);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_classifications_email_id ON classifications(email_id);
CREATE INDEX IF NOT EXISTS idx_classifications_category_id ON classifications(category_id);

-- Create vector index for similarity search using HNSW algorithm
CREATE INDEX IF NOT EXISTS idx_emails_embedding ON emails 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE classifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for categories table
CREATE POLICY "Users can view own categories"
  ON categories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for emails table
CREATE POLICY "Users can view own emails"
  ON emails FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own emails"
  ON emails FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own emails"
  ON emails FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own emails"
  ON emails FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for classifications table
CREATE POLICY "Users can view own classifications"
  ON classifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM emails
      WHERE emails.id = classifications.email_id
      AND emails.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own classifications"
  ON classifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM emails
      WHERE emails.id = classifications.email_id
      AND emails.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own classifications"
  ON classifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM emails
      WHERE emails.id = classifications.email_id
      AND emails.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM emails
      WHERE emails.id = classifications.email_id
      AND emails.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own classifications"
  ON classifications FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM emails
      WHERE emails.id = classifications.email_id
      AND emails.user_id = auth.uid()
    )
  );

-- Create function for cosine similarity search
CREATE OR REPLACE FUNCTION match_emails(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  gmail_id text,
  subject text,
  from_email text,
  to_email text,
  snippet text,
  received_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.gmail_id,
    e.subject,
    e.from_email,
    e.to_email,
    e.snippet,
    e.received_at,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM emails e
  WHERE 
    (filter_user_id IS NULL OR e.user_id = filter_user_id)
    AND e.embedding IS NOT NULL
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
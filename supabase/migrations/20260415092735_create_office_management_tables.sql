/*
  # Office Work Management - Core Tables

  ## Summary
  Creates all tables required for the office work management application.

  ## New Tables
  1. `profiles` - Stores user profile information linked to auth.users
     - id (uuid, PK, references auth.users)
     - full_name (text)
     - email (text)
     - avatar_url (text, optional)
     - created_at, updated_at (timestamps)

  2. `tasks` - Stores routine and single tasks per user
     - id (uuid, PK)
     - user_id (uuid, FK to auth.users)
     - title, description (text)
     - task_type: 'routine' | 'single'
     - status: 'pending' | 'in_progress' | 'completed'
     - task_date (date - start date for routine, specific date for single)
     - is_recurring (boolean)
     - priority: 'low' | 'medium' | 'high'
     - created_at, updated_at (timestamps)

  3. `attendance` - Stores daily check-in/check-out records
     - id (uuid, PK)
     - user_id (uuid, FK to auth.users)
     - check_in (timestamptz)
     - check_out (timestamptz)
     - date (date)
     - total_hours (numeric)
     - notes (text)
     - UNIQUE constraint on (user_id, date)

  4. `leaves` - Stores leave applications
     - id (uuid, PK)
     - user_id (uuid, FK to auth.users)
     - leave_date (date)
     - leave_type: 'casual' | 'sick' | 'earned' | 'other'
     - reason (text)
     - status: 'pending' | 'approved' | 'rejected'
     - UNIQUE constraint on (user_id, leave_date)

  ## Security
  - RLS enabled on all tables
  - Users can only access their own data
  - Authenticated users only policies
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  task_type text NOT NULL DEFAULT 'single' CHECK (task_type IN ('routine', 'single')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  task_date date NOT NULL,
  is_recurring boolean DEFAULT false,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_in timestamptz,
  check_out timestamptz,
  date date NOT NULL,
  total_hours numeric(5,2),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Leaves table
CREATE TABLE IF NOT EXISTS leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_date date NOT NULL,
  leave_type text NOT NULL DEFAULT 'casual' CHECK (leave_type IN ('casual', 'sick', 'earned', 'other')),
  reason text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, leave_date)
);

ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leaves"
  ON leaves FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leaves"
  ON leaves FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leaves"
  ON leaves FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own leaves"
  ON leaves FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

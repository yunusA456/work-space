/*
  # Add Breaks Table for Lunch and Coffee Breaks

  ## Summary
  Adds a breaks table to track lunch and coffee breaks during the work day.

  ## New Tables
  1. `breaks` - Stores break records for each work day
     - id (uuid, PK)
     - user_id (uuid, FK to auth.users)
     - date (date - the work date)
     - break_type: 'lunch' | 'coffee'
     - start_time (timestamptz - when break started)
     - end_time (timestamptz - when break ended)
     - duration_minutes (integer - calculated duration)
     - UNIQUE constraint on (user_id, date, break_type) to allow one lunch and one coffee per day

  ## Security
  - RLS enabled on breaks table
  - Users can only access and modify their own breaks
*/

CREATE TABLE IF NOT EXISTS breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  break_type text NOT NULL CHECK (break_type IN ('lunch', 'coffee')),
  start_time timestamptz,
  end_time timestamptz,
  duration_minutes integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date, break_type)
);

ALTER TABLE breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own breaks"
  ON breaks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own breaks"
  ON breaks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own breaks"
  ON breaks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own breaks"
  ON breaks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

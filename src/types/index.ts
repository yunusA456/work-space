export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string;
  task_type: 'routine' | 'single';
  status: 'pending' | 'in_progress' | 'completed';
  task_date: string;
  is_recurring: boolean;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  check_in?: string;
  check_out?: string;
  date: string;
  total_hours?: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Leave {
  id: string;
  user_id: string;
  leave_date: string;
  leave_type: 'casual' | 'sick' | 'earned' | 'other';
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export type Page = 'dashboard' | 'tasks' | 'attendance' | 'leaves';

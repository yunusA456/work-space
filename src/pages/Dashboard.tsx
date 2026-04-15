import { useEffect, useState } from 'react';
import { Clock, CheckCircle2, CalendarDays, TrendingUp, LogIn, LogOut, ListTodo, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Task, Attendance, Leave } from '../types';

interface DashboardStats {
  todayHours: number | null;
  avgHours: number;
  leavesThisMonth: number;
  todayPending: number;
  todayInProgress: number;
  todayCompleted: number;
  todayTasks: Task[];
  todayAttendance: Attendance | null;
  checkedIn: boolean;
  checkedOut: boolean;
}

function formatHours(hours: number | null | undefined): string {
  if (hours == null) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

function formatTime(ts: string | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    todayHours: null,
    avgHours: 0,
    leavesThisMonth: 0,
    todayPending: 0,
    todayInProgress: 0,
    todayCompleted: 0,
    todayTasks: [],
    todayAttendance: null,
    checkedIn: false,
    checkedOut: false,
  });
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const fetchData = async () => {
    if (!user) return;

    const [attendanceRes, tasksRes, leavesRes, avgRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
      supabase.from('tasks').select('*').eq('user_id', user.id).or(`task_date.eq.${today},is_recurring.eq.true`),
      supabase.from('leaves').select('*').eq('user_id', user.id).gte('leave_date', monthStart).lte('leave_date', monthEnd),
      supabase.from('attendance').select('total_hours').eq('user_id', user.id).gte('date', monthStart).lte('date', monthEnd).not('total_hours', 'is', null),
    ]);

    const attendance = attendanceRes.data as Attendance | null;
    const tasks = (tasksRes.data || []) as Task[];
    const leaves = (leavesRes.data || []) as Leave[];
    const avgData = avgRes.data || [];

    const todayTasks = tasks.filter(t => t.is_recurring || t.task_date === today);
    const pending = todayTasks.filter(t => t.status === 'pending').length;
    const inProgress = todayTasks.filter(t => t.status === 'in_progress').length;
    const completed = todayTasks.filter(t => t.status === 'completed').length;

    const totalHoursArr = avgData.map((r: { total_hours: number }) => Number(r.total_hours)).filter(Boolean);
    const avg = totalHoursArr.length > 0 ? totalHoursArr.reduce((a: number, b: number) => a + b, 0) / totalHoursArr.length : 0;

    let todayHours: number | null = null;
    if (attendance?.check_in && attendance?.check_out) {
      todayHours = Number(attendance.total_hours) || null;
    } else if (attendance?.check_in && !attendance?.check_out) {
      const diff = (Date.now() - new Date(attendance.check_in).getTime()) / 3600000;
      todayHours = Math.round(diff * 100) / 100;
    }

    setStats({
      todayHours,
      avgHours: Math.round(avg * 100) / 100,
      leavesThisMonth: leaves.length,
      todayPending: pending,
      todayInProgress: inProgress,
      todayCompleted: completed,
      todayTasks: todayTasks.slice(0, 5),
      todayAttendance: attendance,
      checkedIn: !!attendance?.check_in,
      checkedOut: !!attendance?.check_out,
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleCheckIn = async () => {
    if (!user || checkingIn) return;
    setCheckingIn(true);
    await supabase.from('attendance').upsert({ user_id: user.id, date: today, check_in: new Date().toISOString() }, { onConflict: 'user_id,date' });
    await fetchData();
    setCheckingIn(false);
  };

  const handleCheckOut = async () => {
    if (!user || checkingIn || !stats.todayAttendance?.check_in) return;
    setCheckingIn(true);
    const checkOutTime = new Date();
    const checkInTime = new Date(stats.todayAttendance.check_in);
    const totalHours = Math.round(((checkOutTime.getTime() - checkInTime.getTime()) / 3600000) * 100) / 100;
    await supabase.from('attendance').update({ check_out: checkOutTime.toISOString(), total_hours: totalHours }).eq('user_id', user.id).eq('date', today);
    await fetchData();
    setCheckingIn(false);
  };

  const greeting = () => {
    const h = now.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const priorityColor = (p: string) => {
    if (p === 'high') return 'text-red-600 bg-red-50';
    if (p === 'medium') return 'text-amber-600 bg-amber-50';
    return 'text-emerald-600 bg-emerald-50';
  };

  const statusColor = (s: string) => {
    if (s === 'completed') return 'text-emerald-700 bg-emerald-100';
    if (s === 'in_progress') return 'text-blue-700 bg-blue-100';
    return 'text-slate-600 bg-slate-100';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{greeting()}, {profile?.full_name?.split(' ')[0] || 'there'}!</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!stats.checkedIn ? (
            <button
              onClick={handleCheckIn}
              disabled={checkingIn}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-all shadow-md shadow-emerald-600/20 disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              Check In
            </button>
          ) : !stats.checkedOut ? (
            <button
              onClick={handleCheckOut}
              disabled={checkingIn}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-all shadow-md shadow-red-600/20 disabled:opacity-60"
            >
              <LogOut className="w-4 h-4" />
              Check Out
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Day Complete
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<Clock className="w-5 h-5 text-blue-600" />}
          iconBg="bg-blue-50"
          label="Today's Hours"
          value={stats.checkedIn ? formatHours(stats.todayHours) : '—'}
          sub={stats.checkedIn ? (stats.checkedOut ? `In: ${formatTime(stats.todayAttendance?.check_in)} · Out: ${formatTime(stats.todayAttendance?.check_out)}` : `Checked in at ${formatTime(stats.todayAttendance?.check_in)}`) : 'Not checked in yet'}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-sky-600" />}
          iconBg="bg-sky-50"
          label="Avg. Daily Hours"
          value={formatHours(stats.avgHours)}
          sub="This month average"
        />
        <StatCard
          icon={<CalendarDays className="w-5 h-5 text-amber-600" />}
          iconBg="bg-amber-50"
          label="Leaves This Month"
          value={String(stats.leavesThisMonth)}
          sub={stats.leavesThisMonth === 1 ? '1 leave day taken' : `${stats.leavesThisMonth} leave days taken`}
        />
        <StatCard
          icon={<ListTodo className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          label="Tasks Today"
          value={String(stats.todayPending + stats.todayInProgress + stats.todayCompleted)}
          sub={`${stats.todayCompleted} done · ${stats.todayPending} pending`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-slate-900 font-semibold text-base mb-4 flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-blue-600" />
            Today's Tasks
          </h2>
          {stats.todayTasks.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No tasks for today</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {stats.todayTasks.map(task => (
                <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-800 text-sm font-medium truncate">{task.title}</span>
                      {task.is_recurring && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Routine</span>
                      )}
                    </div>
                    {task.description && <p className="text-slate-500 text-xs mt-0.5 truncate">{task.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(task.status)}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-slate-900 font-semibold text-base mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Task Summary
          </h2>
          <div className="space-y-4">
            <TaskSummaryBar label="Completed" count={stats.todayCompleted} color="bg-emerald-500" total={stats.todayPending + stats.todayInProgress + stats.todayCompleted} />
            <TaskSummaryBar label="In Progress" count={stats.todayInProgress} color="bg-blue-500" total={stats.todayPending + stats.todayInProgress + stats.todayCompleted} />
            <TaskSummaryBar label="Pending" count={stats.todayPending} color="bg-slate-300" total={stats.todayPending + stats.todayInProgress + stats.todayCompleted} />
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-2xl font-bold text-emerald-600">{stats.todayCompleted}</p>
              <p className="text-xs text-slate-500 mt-0.5">Done</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.todayInProgress}</p>
              <p className="text-xs text-slate-500 mt-0.5">Active</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-500">{stats.todayPending}</p>
              <p className="text-xs text-slate-500 mt-0.5">Pending</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500">Today's Attendance</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Check In</span>
                <span className="font-medium text-slate-800">{formatTime(stats.todayAttendance?.check_in)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Check Out</span>
                <span className="font-medium text-slate-800">{formatTime(stats.todayAttendance?.check_out)}</span>
              </div>
              <div className="flex justify-between text-sm pt-1 border-t border-slate-100">
                <span className="text-slate-500">Total</span>
                <span className="font-semibold text-blue-600">{formatHours(stats.todayHours)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, iconBg, label, value, sub }: { icon: React.ReactNode; iconBg: string; label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 mb-0.5">{value}</p>
      <p className="text-slate-500 text-sm font-medium">{label}</p>
      <p className="text-slate-400 text-xs mt-1">{sub}</p>
    </div>
  );
}

function TaskSummaryBar({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-800 font-medium">{count}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

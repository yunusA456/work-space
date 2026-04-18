import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Calendar, TrendingUp, Clock, CheckCircle2, Coffee } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Task, Attendance, Break } from '../types';

interface ChartData {
  date: string;
  hours: number;
  tasks: number;
  breaks: number;
}

export default function Reports() {
  const { user } = useAuth();
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [taskData, setTaskData] = useState<any[]>([]);
  const [breakData, setBreakData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalHours: 0,
    avgHours: 0,
    totalTasks: 0,
    completedTasks: 0,
    totalBreaks: 0,
    totalBreakTime: 0,
  });
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const fetchReports = async () => {
      if (!user) return;
      setLoading(true);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];
      const now = new Date();
      const endDateStr = now.toISOString().split('T')[0];

      const [attendanceRes, tasksRes, breaksRes] = await Promise.all([
        supabase.from('attendance').select('*').eq('user_id', user.id).gte('date', startDateStr).lte('date', endDateStr).order('date'),
        supabase.from('tasks').select('*').eq('user_id', user.id).gte('created_at', startDate.toISOString()).order('created_at'),
        supabase.from('breaks').select('*').eq('user_id', user.id).gte('date', startDateStr).lte('date', endDateStr).order('date'),
      ]);

      const attendance = (attendanceRes.data || []) as Attendance[];
      const tasks = (tasksRes.data || []) as Task[];
      const breaks_data = (breaksRes.data || []) as Break[];

      const totalAttendance = attendance.filter(a => a.total_hours).map(a => Number(a.total_hours)).reduce((a, b) => a + b, 0);
      const avgAttendance = attendance.filter(a => a.total_hours).length > 0 ? totalAttendance / attendance.filter(a => a.total_hours).length : 0;
      const completedTasksCount = tasks.filter(t => t.status === 'completed').length;
      const totalBreakDuration = breaks_data.filter(b => b.duration_minutes).map(b => b.duration_minutes!).reduce((a, b) => a + b, 0);

      const chartDataMap = new Map<string, ChartData>();
      attendance.forEach(a => {
        if (!chartDataMap.has(a.date)) {
          chartDataMap.set(a.date, { date: a.date, hours: 0, tasks: 0, breaks: 0 });
        }
        const data = chartDataMap.get(a.date)!;
        if (a.total_hours) data.hours = Number(a.total_hours);
      });

      tasks.forEach(t => {
        const dateStr = t.task_date;
        if (!chartDataMap.has(dateStr)) {
          chartDataMap.set(dateStr, { date: dateStr, hours: 0, tasks: 0, breaks: 0 });
        }
        const data = chartDataMap.get(dateStr)!;
        data.tasks += 1;
      });

      breaks_data.forEach(b => {
        if (!chartDataMap.has(b.date)) {
          chartDataMap.set(b.date, { date: b.date, hours: 0, tasks: 0, breaks: 0 });
        }
        const data = chartDataMap.get(b.date)!;
        data.breaks += 1;
      });

      const chartArray = Array.from(chartDataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      setChartData(chartArray);

      const taskStatusCount = [
        { name: 'Completed', value: completedTasksCount, fill: '#10b981' },
        { name: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, fill: '#3b82f6' },
        { name: 'Pending', value: tasks.filter(t => t.status === 'pending').length, fill: '#cbd5e1' },
      ];
      setTaskData(taskStatusCount);

      const breakTypeCount = [
        { name: 'Lunch', value: breaks_data.filter(b => b.break_type === 'lunch').length, fill: '#3b82f6' },
        { name: 'Coffee', value: breaks_data.filter(b => b.break_type === 'coffee').length, fill: '#f97316' },
      ];
      setBreakData(breakTypeCount);

      setStats({
        totalHours: Math.round(totalAttendance * 100) / 100,
        avgHours: Math.round(avgAttendance * 100) / 100,
        totalTasks: tasks.length,
        completedTasks: completedTasksCount,
        totalBreaks: breaks_data.length,
        totalBreakTime: totalBreakDuration,
      });

      setLoading(false);
    };

    fetchReports();
  }, [user, days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Comprehensive insights into your work patterns</p>
        </div>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox
          icon={<Clock className="w-5 h-5 text-blue-600" />}
          bg="bg-blue-50"
          label="Total Hours"
          value={`${Math.floor(stats.totalHours)}h ${Math.round((stats.totalHours % 1) * 60)}m`}
          sub={`Avg: ${Math.floor(stats.avgHours)}h ${Math.round((stats.avgHours % 1) * 60)}m/day`}
        />
        <StatBox
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          bg="bg-emerald-50"
          label="Tasks Completed"
          value={`${stats.completedTasks}/${stats.totalTasks}`}
          sub={`${Math.round((stats.completedTasks / Math.max(stats.totalTasks, 1)) * 100)}% completion`}
        />
        <StatBox
          icon={<Coffee className="w-5 h-5 text-orange-600" />}
          bg="bg-orange-50"
          label="Total Breaks"
          value={`${stats.totalBreaks}`}
          sub={`${stats.totalBreakTime} mins total`}
        />
        <StatBox
          icon={<TrendingUp className="w-5 h-5 text-sky-600" />}
          bg="bg-sky-50"
          label="Working Days"
          value={`${chartData.length}`}
          sub={`In last ${days} days`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Daily Working Hours
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Area type="monotone" dataKey="hours" stroke="#3b82f6" fillOpacity={1} fill="url(#colorHours)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            Daily Tasks
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="tasks" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            Task Status Distribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={taskData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {taskData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Coffee className="w-5 h-5 text-orange-600" />
            Break Type Distribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={breakData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {breakData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-sky-600" />
          Work Hours vs Tasks vs Breaks
        </h2>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <Legend />
            <Line type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
            <Line type="monotone" dataKey="tasks" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
            <Line type="monotone" dataKey="breaks" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatBox({ icon, bg, label, value, sub }: { icon: React.ReactNode; bg: string; label: string; value: string; sub: string }) {
  return (
    <div className={`${bg} rounded-2xl border border-slate-100 shadow-sm p-5`}>
      <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>{icon}</div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm font-medium text-slate-600 mt-0.5">{label}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, CheckCircle2, Circle, Clock4, Trash2, RefreshCw, Flag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Task } from '../types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

interface AddTaskForm {
  title: string;
  description: string;
  task_type: 'routine' | 'single';
  priority: 'low' | 'medium' | 'high';
}

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [calMonth, setCalMonth] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [taskDates, setTaskDates] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<AddTaskForm>({
    title: '', description: '', task_type: 'single', priority: 'medium',
  });

  const fetchTasks = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    const all = (data || []) as Task[];
    setTasks(all);
    const dates = new Set<string>(all.filter(t => !t.is_recurring).map(t => t.task_date));
    setTaskDates(dates);
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, [user]);

  const selectedTasks = tasks.filter(t => t.is_recurring || t.task_date === selectedDate);
  const pending = selectedTasks.filter(t => t.status === 'pending');
  const inProgress = selectedTasks.filter(t => t.status === 'in_progress');
  const completed = selectedTasks.filter(t => t.status === 'completed');

  const handleStatusChange = async (task: Task) => {
    const next = task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'completed' : 'pending';
    await supabase.from('tasks').update({ status: next, updated_at: new Date().toISOString() }).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t));
  };

  const handleDelete = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleAddTask = async () => {
    if (!user || !form.title.trim() || saving) return;
    setSaving(true);
    const { data } = await supabase.from('tasks').insert({
      user_id: user.id,
      title: form.title.trim(),
      description: form.description.trim(),
      task_type: form.task_type,
      status: 'pending',
      task_date: selectedDate,
      is_recurring: form.task_type === 'routine',
      priority: form.priority,
    }).select().single();
    if (data) {
      setTasks(prev => [data as Task, ...prev]);
      if (form.task_type === 'single') {
        setTaskDates(prev => new Set([...prev, selectedDate]));
      }
    }
    setForm({ title: '', description: '', task_type: 'single', priority: 'medium' });
    setShowModal(false);
    setSaving(false);
  };

  const calDays = () => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const days: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  };

  const todayStr = toDateStr(new Date());
  const hasRoutine = tasks.some(t => t.is_recurring);

  const statusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    if (status === 'in_progress') return <Clock4 className="w-5 h-5 text-blue-500" />;
    return <Circle className="w-5 h-5 text-slate-300" />;
  };

  const priorityColor = (p: string) => {
    if (p === 'high') return 'text-red-600 bg-red-50 border-red-100';
    if (p === 'medium') return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-emerald-600 bg-emerald-50 border-emerald-100';
  };

  const TaskGroup = ({ title, items, accent }: { title: string; items: Task[]; accent: string }) => (
    items.length > 0 ? (
      <div>
        <p className={`text-xs font-semibold uppercase tracking-wider ${accent} mb-2`}>{title} ({items.length})</p>
        <div className="space-y-2">
          {items.map(task => (
            <div key={task.id} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
              <button onClick={() => handleStatusChange(task)} className="mt-0.5 flex-shrink-0 hover:scale-110 transition-transform">
                {statusIcon(task.status)}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium text-slate-800 ${task.status === 'completed' ? 'line-through text-slate-400' : ''}`}>{task.title}</span>
                  {task.is_recurring && (
                    <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                      <RefreshCw className="w-3 h-3" />Routine
                    </span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${priorityColor(task.priority)}`}>
                    <Flag className="w-2.5 h-2.5 inline mr-0.5" />{task.priority}
                  </span>
                </div>
                {task.description && <p className="text-slate-500 text-xs mt-0.5">{task.description}</p>}
              </div>
              <button
                onClick={() => handleDelete(task.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    ) : null
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage your daily and routine tasks</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-md shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">{MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}</h2>
            <div className="flex gap-1">
              <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calDays().map((d, i) => {
              if (!d) return <div key={i} />;
              const ds = toDateStr(d);
              const isToday = ds === todayStr;
              const isSelected = ds === selectedDate;
              const hasTask = taskDates.has(ds) || (hasRoutine && ds >= todayStr);
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(ds)}
                  className={`relative aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md'
                      : isToday
                      ? 'bg-blue-50 text-blue-600 font-semibold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {d.getDate()}
                  {hasTask && !isSelected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              Selected: {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="lg:col-span-3 bg-slate-50 rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">
              {selectedDate === todayStr ? "Today's Tasks" : `Tasks for ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            </h2>
            <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-full">
              {selectedTasks.length} total
            </span>
          </div>

          {selectedTasks.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No tasks for this date</p>
              <p className="text-xs mt-1">Click "Add Task" to create one</p>
            </div>
          ) : (
            <div className="space-y-4">
              <TaskGroup title="In Progress" items={inProgress} accent="text-blue-600" />
              <TaskGroup title="Pending" items={pending} accent="text-slate-500" />
              <TaskGroup title="Completed" items={completed} accent="text-emerald-600" />
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-lg">Add New Task</h3>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Task Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="What needs to be done?"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional details..."
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Task Type</label>
                  <select
                    value={form.task_type}
                    onChange={e => setForm(f => ({ ...f, task_type: e.target.value as 'routine' | 'single' }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="single">Single Task</option>
                    <option value="routine">Routine (Daily)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value as 'low' | 'medium' | 'high' }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700">
                {form.task_type === 'routine'
                  ? 'Routine tasks appear every day and repeat automatically.'
                  : `Single task will be added for ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}.`}
              </div>
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition">
                Cancel
              </button>
              <button
                onClick={handleAddTask}
                disabled={!form.title.trim() || saving}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

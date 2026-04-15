import { useEffect, useState, FormEvent } from 'react';
import { CalendarOff, Plus, Trash2, CalendarDays, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Leave } from '../types';

const LEAVE_TYPES = ['casual', 'sick', 'earned', 'other'] as const;

const leaveTypeLabel: Record<string, string> = {
  casual: 'Casual Leave',
  sick: 'Sick Leave',
  earned: 'Earned Leave',
  other: 'Other',
};

const statusStyle: Record<string, string> = {
  pending: 'text-amber-700 bg-amber-100',
  approved: 'text-emerald-700 bg-emerald-100',
  rejected: 'text-red-700 bg-red-100',
};

const leaveTypeColor: Record<string, string> = {
  casual: 'text-blue-700 bg-blue-100',
  sick: 'text-red-700 bg-red-100',
  earned: 'text-emerald-700 bg-emerald-100',
  other: 'text-slate-700 bg-slate-100',
};

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

export default function Leaves() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  const [form, setForm] = useState({ leave_date: todayStr, leave_type: 'casual' as typeof LEAVE_TYPES[number], reason: '' });

  const fetchLeaves = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('leaves')
      .select('*')
      .eq('user_id', user.id)
      .order('leave_date', { ascending: false });
    setLeaves((data || []) as Leave[]);
    setLoading(false);
  };

  useEffect(() => { fetchLeaves(); }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || saving) return;
    setError('');
    setSaving(true);

    const exists = leaves.find(l => l.leave_date === form.leave_date);
    if (exists) {
      setError('You already have a leave application for this date.');
      setSaving(false);
      return;
    }

    const { data, error: err } = await supabase.from('leaves').insert({
      user_id: user.id,
      leave_date: form.leave_date,
      leave_type: form.leave_type,
      reason: form.reason.trim(),
      status: 'pending',
    }).select().single();

    if (err) {
      setError(err.message);
    } else if (data) {
      setLeaves(prev => [data as Leave, ...prev]);
      setForm({ leave_date: todayStr, leave_type: 'casual', reason: '' });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('leaves').delete().eq('id', id);
    setLeaves(prev => prev.filter(l => l.id !== id));
  };

  const thisMonthLeaves = leaves.filter(l => l.leave_date >= monthStart && l.leave_date <= monthEnd);
  const approvedThisMonth = thisMonthLeaves.filter(l => l.status === 'approved').length;
  const pendingCount = leaves.filter(l => l.status === 'pending').length;
  const totalApproved = leaves.filter(l => l.status === 'approved').length;

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'approved') return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    if (status === 'rejected') return <XCircle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-amber-500" />;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Leave Management</h1>
        <p className="text-slate-500 text-sm mt-0.5">Apply for leaves and track your leave history</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
            <CalendarDays className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-0.5">{approvedThisMonth}</p>
          <p className="text-sm font-medium text-slate-600">Leaves This Month</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mb-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-0.5">{pendingCount}</p>
          <p className="text-sm font-medium text-slate-600">Pending Approvals</p>
          <p className="text-xs text-slate-400 mt-0.5">Awaiting review</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-0.5">{totalApproved}</p>
          <p className="text-sm font-medium text-slate-600">Total Approved</p>
          <p className="text-xs text-slate-400 mt-0.5">All time</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Plus className="w-4 h-4 text-white" />
              </div>
              <h2 className="font-semibold text-slate-900">Apply for Leave</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Leave Date *</label>
                <input
                  type="date"
                  value={form.leave_date}
                  onChange={e => setForm(f => ({ ...f, leave_date: e.target.value }))}
                  required
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Leave Type *</label>
                <select
                  value={form.leave_type}
                  onChange={e => setForm(f => ({ ...f, leave_type: e.target.value as typeof LEAVE_TYPES[number] }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {LEAVE_TYPES.map(t => (
                    <option key={t} value={t}>{leaveTypeLabel[t]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason</label>
                <textarea
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Provide a reason for your leave..."
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-red-600 text-sm flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'Submitting...' : 'Submit Leave Application'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Leave History</h2>
            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{leaves.length} total</span>
          </div>

          {leaves.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CalendarOff className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No leave applications yet</p>
              <p className="text-xs mt-1">Apply for leave using the form</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {leaves.map(leave => (
                <div key={leave.id} className="px-6 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors group">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <StatusIcon status={leave.status} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-medium text-slate-800">{formatDate(leave.leave_date)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${leaveTypeColor[leave.leave_type]}`}>
                        {leaveTypeLabel[leave.leave_type]}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[leave.status]}`}>
                        {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                      </span>
                    </div>
                    {leave.reason && (
                      <p className="text-xs text-slate-500 truncate">{leave.reason}</p>
                    )}
                  </div>
                  {leave.status === 'pending' && (
                    <button
                      onClick={() => handleDelete(leave.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

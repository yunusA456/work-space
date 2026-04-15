import { useEffect, useState } from 'react';
import { LogIn, LogOut, Clock, CheckCircle2, XCircle, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Attendance as AttendanceType } from '../types';

function formatTime(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatHours(h: number | null | undefined): string {
  if (h == null) return '—';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function Attendance() {
  const { user } = useAuth();
  const [todayRecord, setTodayRecord] = useState<AttendanceType | null>(null);
  const [history, setHistory] = useState<AttendanceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [liveHours, setLiveHours] = useState<number | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const fetchData = async () => {
    if (!user) return;
    const [todayRes, historyRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
      supabase.from('attendance').select('*').eq('user_id', user.id).gte('date', monthStart).order('date', { ascending: false }),
    ]);
    setTodayRecord(todayRes.data as AttendanceType | null);
    setHistory((historyRes.data || []) as AttendanceType[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  useEffect(() => {
    if (todayRecord?.check_in && !todayRecord?.check_out) {
      const interval = setInterval(() => {
        const diff = (Date.now() - new Date(todayRecord.check_in!).getTime()) / 3600000;
        setLiveHours(Math.round(diff * 100) / 100);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setLiveHours(null);
    }
  }, [todayRecord]);

  const handleCheckIn = async () => {
    if (!user || busy) return;
    setBusy(true);
    await supabase.from('attendance').upsert({ user_id: user.id, date: today, check_in: new Date().toISOString() }, { onConflict: 'user_id,date' });
    await fetchData();
    setBusy(false);
  };

  const handleCheckOut = async () => {
    if (!user || busy || !todayRecord?.check_in) return;
    setBusy(true);
    const checkOutTime = new Date();
    const checkInTime = new Date(todayRecord.check_in);
    const totalHours = Math.round(((checkOutTime.getTime() - checkInTime.getTime()) / 3600000) * 100) / 100;
    await supabase.from('attendance').update({ check_out: checkOutTime.toISOString(), total_hours: totalHours }).eq('user_id', user.id).eq('date', today);
    await fetchData();
    setBusy(false);
  };

  const checkedIn = !!todayRecord?.check_in;
  const checkedOut = !!todayRecord?.check_out;

  const thisMonthHours = history.filter(r => r.total_hours != null).map(r => Number(r.total_hours));
  const totalMonthHours = thisMonthHours.reduce((a, b) => a + b, 0);
  const avgMonthHours = thisMonthHours.length > 0 ? totalMonthHours / thisMonthHours.length : 0;
  const daysPresent = history.filter(r => r.check_in).length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
        <p className="text-slate-500 text-sm mt-0.5">Track your daily check-in and check-out</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
          <p className="text-blue-100 text-sm mb-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <h2 className="text-2xl font-bold">Today's Attendance</h2>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-500 mb-1">Check In</p>
              <p className="text-lg font-bold text-slate-800">{formatTime(todayRecord?.check_in)}</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-500 mb-1">Check Out</p>
              <p className="text-lg font-bold text-slate-800">{formatTime(todayRecord?.check_out)}</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <p className="text-xs text-blue-500 mb-1">Hours Worked</p>
              <p className="text-lg font-bold text-blue-700">
                {checkedIn ? formatHours(checkedOut ? todayRecord?.total_hours : liveHours) : '—'}
              </p>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            {!checkedIn ? (
              <button
                onClick={handleCheckIn}
                disabled={busy}
                className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-60 text-sm"
              >
                <LogIn className="w-5 h-5" />
                Check In Now
              </button>
            ) : !checkedOut ? (
              <>
                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl text-sm font-medium">
                  <CheckCircle2 className="w-5 h-5" />
                  Checked in at {formatTime(todayRecord?.check_in)}
                </div>
                <button
                  onClick={handleCheckOut}
                  disabled={busy}
                  className="flex items-center gap-3 bg-red-600 hover:bg-red-500 text-white px-8 py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-red-600/20 disabled:opacity-60 text-sm"
                >
                  <LogOut className="w-5 h-5" />
                  Check Out
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 bg-slate-100 text-slate-700 px-6 py-3 rounded-xl text-sm font-medium">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Work day complete — {formatHours(todayRecord?.total_hours)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<Clock className="w-5 h-5 text-blue-600" />} bg="bg-blue-50" label="Days Present" value={String(daysPresent)} sub="This month" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} bg="bg-emerald-50" label="Total Hours" value={formatHours(totalMonthHours)} sub="This month" />
        <StatCard icon={<Calendar className="w-5 h-5 text-amber-600" />} bg="bg-amber-50" label="Avg. Hours/Day" value={formatHours(avgMonthHours)} sub="This month" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Monthly Attendance History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Check In</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Check Out</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Hours</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400 text-sm">
                    <XCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No attendance records this month
                  </td>
                </tr>
              ) : (
                history.map(record => (
                  <tr key={record.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3.5 text-sm font-medium text-slate-800">{formatDate(record.date)}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{formatTime(record.check_in)}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{formatTime(record.check_out)}</td>
                    <td className="px-6 py-3.5 text-sm font-medium text-slate-800">{formatHours(record.total_hours)}</td>
                    <td className="px-6 py-3.5">
                      {record.check_out ? (
                        <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">Complete</span>
                      ) : record.check_in ? (
                        <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">In Progress</span>
                      ) : (
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">Absent</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, bg, label, value, sub }: { icon: React.ReactNode; bg: string; label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>{icon}</div>
      <p className="text-2xl font-bold text-slate-900 mb-0.5">{value}</p>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

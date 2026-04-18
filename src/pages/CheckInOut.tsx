import { useEffect, useState } from 'react';
import { LogIn, LogOut, CheckCircle2, Coffee, UtensilsCrossed, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Attendance as AttendanceType, Break } from '../types';

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

export default function CheckInOut() {
  const { user } = useAuth();
  const [todayRecord, setTodayRecord] = useState<AttendanceType | null>(null);
  const [todayBreaks, setTodayBreaks] = useState<Break[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [liveHours, setLiveHours] = useState<number | null>(null);
  const [activeBreak, setActiveBreak] = useState<'lunch' | 'coffee' | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const fetchData = async () => {
    if (!user) return;
    const [todayRes, breaksRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
      supabase.from('breaks').select('*').eq('user_id', user.id).eq('date', today),
    ]);
    setTodayRecord(todayRes.data as AttendanceType | null);
    const breaks_data = (breaksRes.data || []) as Break[];
    setTodayBreaks(breaks_data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (todayRecord?.check_in && !todayRecord?.check_out) {
        const checkInTime = new Date(todayRecord.check_in).getTime();
        const now = Date.now();
        let totalBreakMs = 0;
        todayBreaks.forEach(b => {
          if (b.start_time && b.end_time) {
            totalBreakMs += new Date(b.end_time).getTime() - new Date(b.start_time).getTime();
          } else if (b.start_time && !b.end_time && (b.break_type === activeBreak)) {
            totalBreakMs += now - new Date(b.start_time).getTime();
          }
        });
        const diff = (now - checkInTime - totalBreakMs) / 3600000;
        setLiveHours(Math.round(diff * 100) / 100);
      } else {
        setLiveHours(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [todayRecord, todayBreaks, activeBreak]);

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
    let totalBreakMs = 0;
    todayBreaks.forEach(b => {
      if (b.start_time && b.end_time) {
        totalBreakMs += new Date(b.end_time).getTime() - new Date(b.start_time).getTime();
      }
    });
    const totalHours = Math.round(((checkOutTime.getTime() - checkInTime.getTime() - totalBreakMs) / 3600000) * 100) / 100;
    await supabase.from('attendance').update({ check_out: checkOutTime.toISOString(), total_hours: totalHours }).eq('user_id', user.id).eq('date', today);
    await fetchData();
    setBusy(false);
  };

  const handleStartBreak = async (breakType: 'lunch' | 'coffee') => {
    if (!user || busy || !todayRecord?.check_in) return;
    setBusy(true);
    if (breakType === 'lunch') {
      const existing = todayBreaks.find(b => b.break_type === 'lunch');
      if (existing?.start_time && !existing?.end_time) {
        setBusy(false);
        return;
      }
    }
    const { error } = await supabase.from('breaks').insert({
      user_id: user.id,
      date: today,
      break_type: breakType,
      start_time: new Date().toISOString(),
    });
    if (!error) {
      setActiveBreak(breakType);
      await fetchData();
    }
    setBusy(false);
  };

  const handleEndBreak = async (breakId: string, breakType: 'lunch' | 'coffee') => {
    if (!user || busy) return;
    setBusy(true);
    const breakRecord = todayBreaks.find(b => b.id === breakId);
    if (!breakRecord?.start_time) {
      setBusy(false);
      return;
    }
    const endTime = new Date();
    const startTime = new Date(breakRecord.start_time);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.round(durationMs / 60000);
    await supabase.from('breaks').update({
      end_time: endTime.toISOString(),
      duration_minutes: durationMinutes,
    }).eq('id', breakId);
    if (activeBreak === breakType) {
      setActiveBreak(null);
    }
    await fetchData();
    setBusy(false);
  };

  const checkedIn = !!todayRecord?.check_in;
  const checkedOut = !!todayRecord?.check_out;
  const lunchBreak = todayBreaks.find(b => b.break_type === 'lunch');
  const coffeeBreaks = todayBreaks.filter(b => b.break_type === 'coffee');
  const activeCoffeeBreak = coffeeBreaks.find(b => !b.end_time);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Check In & Out</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your work hours and breaks with ease</p>
      </div>

      <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 rounded-3xl shadow-2xl overflow-hidden">
        <div className="relative h-40 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-pulse" />
          </div>
          <div className="relative text-center">
            <p className="text-blue-100 text-sm mb-2">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h2 className="text-4xl font-bold text-white mb-2">
              {checkedIn ? formatHours(checkedOut ? todayRecord?.total_hours : liveHours) : '—'}
            </h2>
            <p className="text-blue-100 text-sm">
              {checkedIn ? (checkedOut ? 'Work day complete' : 'Work in progress') : 'Not checked in'}
            </p>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="text-center p-5 bg-slate-800/50 rounded-2xl border border-slate-700">
              <p className="text-slate-400 text-xs mb-2 uppercase tracking-wider">Check In</p>
              <p className="text-2xl font-bold text-white">{formatTime(todayRecord?.check_in)}</p>
              <p className="text-slate-500 text-xs mt-1">
                {todayRecord?.check_in ? new Date(todayRecord.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
              </p>
            </div>
            <div className="text-center p-5 bg-slate-800/50 rounded-2xl border border-slate-700">
              <p className="text-slate-400 text-xs mb-2 uppercase tracking-wider">Check Out</p>
              <p className="text-2xl font-bold text-white">{formatTime(todayRecord?.check_out)}</p>
              <p className="text-slate-500 text-xs mt-1">
                {todayRecord?.check_out ? new Date(todayRecord.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
              </p>
            </div>
            <div className="text-center p-5 bg-blue-600/20 rounded-2xl border border-blue-500/30">
              <p className="text-blue-300 text-xs mb-2 uppercase tracking-wider">Duration</p>
              <p className="text-2xl font-bold text-blue-300">{formatHours(checkedOut ? todayRecord?.total_hours : liveHours)}</p>
              <p className="text-blue-400 text-xs mt-1">hours worked</p>
            </div>
          </div>

          <div className="flex gap-4 flex-wrap justify-center mb-8">
            {!checkedIn ? (
              <button
                onClick={handleCheckIn}
                disabled={busy}
                className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-10 py-4 rounded-2xl font-semibold transition-all shadow-lg shadow-emerald-600/30 text-lg"
              >
                <LogIn className="w-6 h-6" />
                Start Work Day
              </button>
            ) : !checkedOut ? (
              <>
                <div className="flex items-center gap-3 px-6 py-3 bg-emerald-600/20 border border-emerald-500/50 rounded-xl text-sm font-medium text-emerald-300">
                  <CheckCircle2 className="w-5 h-5" />
                  Checked in at {formatTime(todayRecord?.check_in)}
                </div>
                <button
                  onClick={handleCheckOut}
                  disabled={busy || !!activeBreak}
                  title={activeBreak ? 'Complete your break before checking out' : ''}
                  className="flex items-center gap-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-10 py-4 rounded-2xl font-semibold transition-all shadow-lg shadow-red-600/30 text-lg"
                >
                  <LogOut className="w-6 h-6" />
                  End Work Day
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3 bg-emerald-600/20 border border-emerald-500/50 rounded-2xl px-8 py-4 text-emerald-300 font-semibold text-lg">
                <CheckCircle2 className="w-6 h-6" />
                Day Complete — {formatHours(todayRecord?.total_hours)}
              </div>
            )}
          </div>
        </div>
      </div>

      {checkedIn && !checkedOut && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BreakSection
            icon={<UtensilsCrossed className="w-6 h-6" />}
            title="Lunch Break"
            color="blue"
            breakRecord={lunchBreak}
            isActive={activeBreak === 'lunch'}
            onStart={() => handleStartBreak('lunch')}
            onEnd={() => lunchBreak && handleEndBreak(lunchBreak.id, 'lunch')}
            busy={busy}
          />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Coffee className="w-5 h-5 text-orange-600" />
                Coffee Breaks
              </h3>
              <button
                onClick={() => handleStartBreak('coffee')}
                disabled={busy || !!activeCoffeeBreak}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {coffeeBreaks.length === 0 ? (
                <div className="col-span-2 text-center py-6 text-slate-400 bg-slate-50 rounded-xl">
                  <Coffee className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No coffee breaks yet</p>
                </div>
              ) : (
                coffeeBreaks.map((cofBreak, idx) => (
                  <CoffeeBreakCard
                    key={cofBreak.id}
                    breakRecord={cofBreak}
                    isActive={activeCoffeeBreak?.id === cofBreak.id}
                    number={idx + 1}
                    onEnd={() => handleEndBreak(cofBreak.id, 'coffee')}
                    busy={busy}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {checkedIn && todayBreaks.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Break Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {todayBreaks.map(brk => (
              <div key={brk.id} className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {brk.break_type === 'lunch' ? (
                      <UtensilsCrossed className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Coffee className="w-4 h-4 text-orange-600" />
                    )}
                    <span className="font-medium text-slate-700 capitalize">{brk.break_type}</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {brk.end_time ? 'Completed' : 'Active'}
                  </span>
                </div>
                <div className="text-sm text-slate-600">
                  <p>{formatTime(brk.start_time)} → {formatTime(brk.end_time)}</p>
                  {brk.duration_minutes && (
                    <p className="text-emerald-600 font-semibold mt-1">{brk.duration_minutes} minutes</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BreakSection({
  icon,
  title,
  color,
  breakRecord,
  isActive,
  onStart,
  onEnd,
  busy,
}: {
  icon: React.ReactNode;
  title: string;
  color: 'blue' | 'orange';
  breakRecord?: Break;
  isActive: boolean;
  onStart: () => void;
  onEnd: () => void;
  busy: boolean;
}) {
  const [liveMinutes, setLiveMinutes] = useState(0);

  useEffect(() => {
    if (isActive && breakRecord?.start_time && !breakRecord?.end_time) {
      const interval = setInterval(() => {
        const diff = (Date.now() - new Date(breakRecord.start_time!).getTime()) / 60000;
        setLiveMinutes(Math.floor(diff));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isActive, breakRecord]);

  const hasBreak = !!breakRecord?.start_time;
  const isCompleted = !!breakRecord?.end_time;
  const duration = breakRecord?.duration_minutes || 0;
  const colorClasses = color === 'blue'
    ? { active: 'border-blue-500 bg-blue-50', completed: 'border-emerald-200 bg-emerald-50', default: 'border-slate-200 bg-slate-50', icon: 'bg-blue-200 text-blue-700', bar: 'bg-blue-200', barFill: 'bg-blue-500' }
    : { active: 'border-orange-500 bg-orange-50', completed: 'border-emerald-200 bg-emerald-50', default: 'border-slate-200 bg-slate-50', icon: 'bg-orange-200 text-orange-700', bar: 'bg-orange-200', barFill: 'bg-orange-500' };

  return (
    <div className={`border-2 rounded-2xl p-6 transition-all ${
      isActive ? colorClasses.active : isCompleted ? colorClasses.completed : colorClasses.default
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses.icon}`}>
            {icon}
          </div>
          <h4 className="font-semibold text-slate-900 text-base">{title}</h4>
        </div>
      </div>

      {isCompleted ? (
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Start</span>
            <span className="text-slate-900 font-medium">{formatTime(breakRecord?.start_time)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">End</span>
            <span className="text-slate-900 font-medium">{formatTime(breakRecord?.end_time)}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-slate-300">
            <span className="text-slate-600 font-medium">Duration</span>
            <span className="text-emerald-600 font-bold">{duration}m</span>
          </div>
        </div>
      ) : isActive ? (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-slate-700">Break in Progress</span>
            <span className={`text-lg font-bold ${color === 'blue' ? 'text-blue-700' : 'text-orange-700'}`}>{liveMinutes}m</span>
          </div>
          <div className={`h-2 ${colorClasses.bar} rounded-full overflow-hidden`}>
            <div className={`h-full ${colorClasses.barFill} rounded-full animate-pulse`} />
          </div>
        </div>
      ) : hasBreak ? (
        <p className="text-sm text-slate-600 mb-4">
          Started at {formatTime(breakRecord?.start_time)}
        </p>
      ) : (
        <p className="text-sm text-slate-600 mb-4">Not taken yet</p>
      )}

      <div className="flex gap-2">
        {!hasBreak ? (
          <button
            onClick={onStart}
            disabled={busy}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition"
          >
            Start Break
          </button>
        ) : !isCompleted ? (
          <button
            onClick={onEnd}
            disabled={busy}
            className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg transition"
          >
            End Break
          </button>
        ) : (
          <div className="w-full px-4 py-2.5 bg-emerald-100 text-emerald-700 font-medium rounded-lg text-center">
            Completed
          </div>
        )}
      </div>
    </div>
  );
}

function CoffeeBreakCard({
  breakRecord,
  isActive,
  number,
  onEnd,
  busy,
}: {
  breakRecord: Break;
  isActive: boolean;
  number: number;
  onEnd: () => void;
  busy: boolean;
}) {
  const [liveMinutes, setLiveMinutes] = useState(0);

  useEffect(() => {
    if (isActive && breakRecord?.start_time && !breakRecord?.end_time) {
      const interval = setInterval(() => {
        const diff = (Date.now() - new Date(breakRecord.start_time!).getTime()) / 60000;
        setLiveMinutes(Math.floor(diff));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isActive, breakRecord]);

  const isCompleted = !!breakRecord?.end_time;
  const duration = breakRecord?.duration_minutes || 0;

  return (
    <div className={`rounded-xl p-3.5 border-2 transition-all ${
      isActive
        ? 'border-orange-500 bg-orange-50'
        : isCompleted
        ? 'border-emerald-200 bg-emerald-50'
        : 'border-slate-200 bg-slate-50'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-900">#{number}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          isActive ? 'bg-orange-200 text-orange-700' : isCompleted ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-200 text-slate-700'
        }`}>
          {isActive ? 'Active' : isCompleted ? `${duration}m` : 'Ready'}
        </span>
      </div>

      {isActive && (
        <div className="mb-2">
          <div className="h-1.5 bg-orange-200 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full animate-pulse" />
          </div>
          <p className="text-xs text-orange-700 mt-1.5 font-medium">{liveMinutes}m elapsed</p>
        </div>
      )}

      {!isCompleted && (
        <button
          onClick={onEnd}
          disabled={busy || !isActive}
          className="w-full text-xs py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
        >
          End Break
        </button>
      )}
    </div>
  );
}

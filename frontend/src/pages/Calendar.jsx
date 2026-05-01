import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles, Trash2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import CalendarGrid from '../components/CalendarGrid';
import LoadingSpinner from '../components/LoadingSpinner';
import { MONTHS } from '../utils/helpers';

export default function Calendar() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  useEffect(() => {
    api.get(`/api/social/clients/${clientId}`).then((r) => setClient(r.data));
  }, [clientId]);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/calendar/${clientId}/${month}/${year}`);
      setCalendar(res.data);
    } catch (err) {
      if (err.response?.status !== 404) toast.error('Failed to load calendar');
      setCalendar(null);
    } finally {
      setLoading(false);
    }
  }, [clientId, month, year]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  const generateCalendar = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/api/calendar/generate', { clientId, month, year });
      setCalendar(res.data);
      toast.success('Calendar generated!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const deleteCalendar = async () => {
    if (!confirm('Delete this calendar and all its posts?')) return;
    try {
      await api.delete(`/api/calendar/${clientId}/${month}/${year}`);
      setCalendar(null);
      toast.success('Calendar deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  const handlePostUpdate = (dayId, updatedPost) => {
    setCalendar((cal) => ({
      ...cal,
      days: cal.days.map((d) =>
        d.id === dayId ? { ...d, post: updatedPost } : d
      ),
    }));
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/clients/${clientId}`} className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Content Calendar</h1>
          <p className="text-slate-400 text-sm">{client?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {calendar && (
            <button onClick={deleteCalendar} className="btn-secondary btn-sm text-red-400 hover:text-red-300">
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button
            onClick={generateCalendar}
            disabled={generating || !!calendar}
            className="btn-primary"
          >
            {generating ? <LoadingSpinner size="sm" /> : <Sparkles size={16} />}
            {calendar ? 'Generated' : 'Generate Calendar'}
          </button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="card p-4 flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-white">{MONTHS[month - 1]} {year}</h2>
          {calendar && (
            <p className="text-xs text-slate-500 mt-0.5">{calendar.days?.length} days planned</p>
          )}
        </div>
        <button onClick={nextMonth} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : !calendar ? (
        <div className="card p-16 text-center">
          <Sparkles size={40} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-300 font-medium mb-1">No calendar for {MONTHS[month - 1]} {year}</p>
          <p className="text-slate-500 text-sm mb-4">Generate a full month content calendar using AI</p>
          <button onClick={generateCalendar} disabled={generating} className="btn-primary mx-auto">
            {generating ? <LoadingSpinner size="sm" /> : <Sparkles size={16} />}
            Generate with AI
          </button>
        </div>
      ) : (
        <CalendarGrid
          calendar={calendar}
          clientId={clientId}
          month={month}
          year={year}
          onPostUpdate={handlePostUpdate}
        />
      )}
    </div>
  );
}

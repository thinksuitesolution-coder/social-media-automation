import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Clock, TrendingUp, CheckCircle } from 'lucide-react';
import api from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const TABS = ['A/B Testing', 'Smart Scheduler'];

// ─── A/B Testing Tab ──────────────────────────────────────────────────────────
function ABTestTab({ clientId }) {
  const [tests, setTests] = useState([]);
  const [form, setForm] = useState({ topic: '', testType: 'CAPTION' });
  const [variants, setVariants] = useState(null);
  const [activeTest, setActiveTest] = useState(null);
  const [metrics, setMetrics] = useState({ a: { reach: '', likes: '', comments: '', engagementRate: '' }, b: { reach: '', likes: '', comments: '', engagementRate: '' } });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const load = () => {
    setFetching(true);
    api.get(`/api/social/abtest/${clientId}`).then((r) => setTests(r.data)).catch(() => {}).finally(() => setFetching(false));
  };
  useEffect(load, [clientId]);

  const generateVariants = async () => {
    if (!form.topic) return toast.error('Enter a topic');
    setLoading(true);
    try {
      const r = await api.post(`/api/social/abtest/generate-variants/${clientId}`, form);
      setVariants(r.data);
    } catch { toast.error('Failed to generate variants'); }
    finally { setLoading(false); }
  };

  const createTest = async () => {
    if (!variants) return;
    setLoading(true);
    try {
      const r = await api.post('/api/social/abtest/create', {
        clientId, testType: form.testType,
        variantA: variants.variantA, variantB: variants.variantB,
      });
      setActiveTest(r.data);
      load();
      toast.success('A/B test started!');
    } catch { toast.error('Failed to create test'); }
    finally { setLoading(false); }
  };

  const submitResults = async () => {
    if (!activeTest) return;
    const toNum = (v) => parseFloat(v) || 0;
    setLoading(true);
    try {
      const r = await api.post(`/api/social/abtest/results/${activeTest.id}`, {
        variantAMetrics: { reach: toNum(metrics.a.reach), likes: toNum(metrics.a.likes), comments: toNum(metrics.a.comments), engagementRate: toNum(metrics.a.engagementRate) },
        variantBMetrics: { reach: toNum(metrics.b.reach), likes: toNum(metrics.b.likes), comments: toNum(metrics.b.comments), engagementRate: toNum(metrics.b.engagementRate) },
      });
      toast.success(`Winner: Variant ${r.data.winner}! ${r.data.confidence} confidence`);
      setActiveTest(null);
      setVariants(null);
      load();
    } catch { toast.error('Failed to submit results'); }
    finally { setLoading(false); }
  };

  if (fetching) return <div className="flex justify-center py-10"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Create New A/B Test</h3>
        <div className="flex gap-3">
          <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Topic to test"
            className="flex-1 bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500" />
          <select value={form.testType} onChange={(e) => setForm({ ...form, testType: e.target.value })}
            className="bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500">
            {['CAPTION', 'IMAGE', 'HASHTAG', 'TIME'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={generateVariants} disabled={loading}
          className="w-full py-2.5 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-600 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <LoadingSpinner size="sm" /> : <FlaskConical size={16} />}
          {loading ? 'Generating...' : 'Generate Variants'}
        </button>
      </div>

      {variants && (
        <div className="space-y-3">
          {[['A', variants.variantA], ['B', variants.variantB]].map(([v, variant]) => (
            <div key={v} className={`card p-4 border-l-2 ${v === 'A' ? 'border-brand-600' : 'border-purple-600'}`}>
              <p className="text-xs font-semibold text-slate-400 mb-2">Variant {v} — {variant.label}</p>
              <p className="text-sm text-slate-200 mb-2">{variant.caption}</p>
              <p className="text-xs text-slate-500">{variant.strategy}</p>
            </div>
          ))}
          <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400">
            <strong className="text-slate-300">Testing:</strong> {variants.whatWeAreTesting}
          </div>
          <button onClick={createTest} disabled={loading}
            className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50">
            {loading ? 'Creating...' : 'Start A/B Test'}
          </button>
        </div>
      )}

      {activeTest && !variants && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Submit Results for Active Test</h3>
          <p className="text-xs text-slate-400">Post both variants, wait 24h, then enter the performance metrics below.</p>
          {['a', 'b'].map((v) => (
            <div key={v} className={`border rounded-lg p-3 ${v === 'a' ? 'border-brand-600/30' : 'border-purple-600/30'}`}>
              <p className="text-xs font-semibold text-slate-400 mb-3">Variant {v.toUpperCase()} Results</p>
              <div className="grid grid-cols-2 gap-2">
                {['reach', 'likes', 'comments', 'engagementRate'].map((k) => (
                  <input key={k} type="number" value={metrics[v][k]} onChange={(e) => setMetrics((m) => ({ ...m, [v]: { ...m[v], [k]: e.target.value } }))}
                    placeholder={k === 'engagementRate' ? 'ER %' : k}
                    className="bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500" />
                ))}
              </div>
            </div>
          ))}
          <button onClick={submitResults} disabled={loading}
            className="w-full py-2.5 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 disabled:opacity-50">
            {loading ? 'Analyzing...' : 'Declare Winner'}
          </button>
        </div>
      )}

      {tests.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Test History</h3>
          <div className="space-y-2">
            {tests.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2 bg-slate-800 rounded-lg text-sm">
                <div>
                  <p className="text-slate-200">{t.testType}</p>
                  <p className="text-xs text-slate-500">{new Date(t.startedAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {t.status === 'COMPLETED' && t.winnerId && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle size={12} /> Winner: {t.winnerId}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'RUNNING' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-slate-700 text-slate-400'}`}>
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Smart Scheduler Tab ──────────────────────────────────────────────────────
function SchedulerTab({ clientId }) {
  const [schedule, setSchedule] = useState(null);
  const [events, setEvents] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api.get(`/api/social/scheduler/${clientId}`).then((r) => setSchedule(r.data)).catch(() => {}).finally(() => setFetching(false));
  }, [clientId]);

  const optimize = async () => {
    setLoading(true);
    try {
      const r = await api.post(`/api/social/scheduler/optimize/${clientId}`, { upcomingEvents: events });
      setSchedule(r.data);
      toast.success('Schedule optimized!');
    } catch { toast.error('Optimization failed'); }
    finally { setLoading(false); }
  };

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const engagementColor = (level) => level === 'HIGH' ? 'text-green-400' : level === 'MEDIUM' ? 'text-yellow-400' : 'text-slate-400';

  if (fetching) return <div className="flex justify-center py-10"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      {schedule && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock size={16} className="text-brand-400" /> Optimal Schedule
          </h3>
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((day) => (
              <div key={day} className="text-center">
                <p className="text-xs text-slate-500 mb-1">{day.slice(0, 3)}</p>
                <div className="bg-slate-800 rounded-lg p-2">
                  <p className="text-xs font-medium text-brand-400">{schedule.weeklySchedule?.[day] || '—'}</p>
                </div>
              </div>
            ))}
          </div>
          {schedule.bestTimes?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Best Posting Times</p>
              <div className="space-y-2">
                {schedule.bestTimes.slice(0, 4).map((t, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs">
                    <span className="text-brand-400 font-medium shrink-0">{t.day} {t.time}</span>
                    <span className={`shrink-0 ${engagementColor(t.expectedEngagement)}`}>{t.expectedEngagement}</span>
                    <span className="text-slate-400">{t.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {schedule.worstTimes?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Avoid These Times</p>
              <p className="text-xs text-red-400">{schedule.worstTimes.join(' · ')}</p>
            </div>
          )}
          {schedule.specialNotes && (
            <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-300">{schedule.specialNotes}</div>
          )}
        </div>
      )}

      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">{schedule ? 'Re-optimize Schedule' : 'Optimize Schedule'}</h3>
        <p className="text-xs text-slate-400">AI analyzes past post performance + audience patterns to find your best posting times.</p>
        <input value={events} onChange={(e) => setEvents(e.target.value)} placeholder="Upcoming events/festivals this month (optional)"
          className="w-full bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500" />
        <button onClick={optimize} disabled={loading}
          className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <LoadingSpinner size="sm" /> : <TrendingUp size={16} />}
          {loading ? 'Optimizing...' : 'Optimize Posting Schedule'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OptimizationTools() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    api.get(`/api/social/clients/${clientId}`).then((r) => setClient(r.data)).catch(() => {});
  }, [clientId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/clients/${clientId}`} className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Optimization Tools</h1>
          <p className="text-slate-400 text-sm">{client?.name} · Data-driven performance</p>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === i ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && <ABTestTab clientId={clientId} />}
      {tab === 1 && <SchedulerTab clientId={clientId} />}
    </div>
  );
}

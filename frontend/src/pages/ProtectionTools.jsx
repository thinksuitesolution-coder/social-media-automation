import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, MessageSquare, TrendingUp, AlertTriangle, CheckCircle, Copy } from 'lucide-react';
import api from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const TABS = ['Crisis Detection', 'Comment Strategy', 'Growth Advisor'];
const SEVERITY_COLORS = { NONE: 'text-green-400', LOW: 'text-blue-400', MEDIUM: 'text-yellow-400', HIGH: 'text-orange-400', CRITICAL: 'text-red-400' };
const SEVERITY_BG = { NONE: 'bg-green-900/20 border-green-700/30', LOW: 'bg-blue-900/20 border-blue-700/30', MEDIUM: 'bg-yellow-900/20 border-yellow-700/30', HIGH: 'bg-orange-900/20 border-orange-700/30', CRITICAL: 'bg-red-900/20 border-red-700/30' };

// ─── Crisis Detection Tab ─────────────────────────────────────────────────────
function CrisisTab({ clientId }) {
  const [alerts, setAlerts] = useState([]);
  const [form, setForm] = useState({ comments: '', volume: '', hours: '24' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadAlerts = () => {
    api.get(`/api/social/crisis/${clientId}`).then((r) => setAlerts(r.data)).catch(() => {});
  };
  useEffect(loadAlerts, [clientId]);

  const analyze = async () => {
    setLoading(true);
    try {
      const negativeComments = form.comments.split('\n').map((l) => l.trim()).filter(Boolean);
      const r = await api.post(`/api/social/crisis/analyze/${clientId}`, {
        negativeComments, volume: form.volume, hours: form.hours,
      });
      setResult(r.data);
      if (r.data.alertCreated) loadAlerts();
      toast.success('Crisis analysis complete');
    } catch { toast.error('Analysis failed'); }
    finally { setLoading(false); }
  };

  const resolve = async (id) => {
    try {
      await api.post(`/api/social/crisis/resolve/${id}`);
      setAlerts((a) => a.filter((x) => x.id !== id));
      toast.success('Alert resolved');
    } catch { toast.error('Failed to resolve'); }
  };

  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" /> Active Alerts ({alerts.length})
          </h3>
          {alerts.map((a) => (
            <div key={a.id} className={`card p-4 border ${SEVERITY_BG[a.severity] || 'border-slate-700'}`}>
              <div className="flex items-start justify-between mb-2">
                <span className={`text-sm font-semibold ${SEVERITY_COLORS[a.severity]}`}>{a.severity} — {a.type}</span>
                <button onClick={() => resolve(a.id)} className="text-xs text-slate-500 hover:text-green-400">Resolve</button>
              </div>
              <p className="text-sm text-slate-300">{a.description}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Run Crisis Analysis</h3>
        <textarea value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })}
          placeholder="Paste negative comments here (one per line)..."
          rows={5}
          className="w-full bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500 resize-none" />
        <div className="flex gap-3">
          <input type="number" value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} placeholder="Total complaint volume"
            className="flex-1 bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500" />
          <select value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })}
            className="bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500">
            {['6', '12', '24', '48'].map((h) => <option key={h} value={h}>Last {h}h</option>)}
          </select>
        </div>
        <button onClick={analyze} disabled={loading}
          className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <LoadingSpinner size="sm" /> : <ShieldAlert size={16} />}
          {loading ? 'Analyzing...' : 'Analyze Crisis Risk'}
        </button>
      </div>

      {result && (
        <div className={`card p-5 space-y-4 border ${SEVERITY_BG[result.crisisLevel] || 'border-slate-700'}`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-semibold ${SEVERITY_COLORS[result.crisisLevel]}`}>
              Crisis Level: {result.crisisLevel}
            </h3>
            <span className={`text-xs px-2 py-1 rounded-full border ${SEVERITY_BG[result.crisisLevel]}`}>
              Posting: {result.postingRecommendation}
            </span>
          </div>
          {result.rootCause && <p className="text-sm text-slate-300"><strong className="text-slate-400">Root cause:</strong> {result.rootCause}</p>}
          {result.immediateActions?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Immediate Actions</p>
              {result.immediateActions.map((a, i) => (
                <p key={i} className="text-sm text-slate-200 mb-1">• {a}</p>
              ))}
            </div>
          )}
          {result.prStatement && (
            <div className="bg-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">PR Statement (ready to post)</p>
              <p className="text-sm text-slate-200">{result.prStatement}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Comment Strategy Tab ─────────────────────────────────────────────────────
function CommentsTab({ clientId }) {
  const [form, setForm] = useState({ postContent: '', accountType: 'COMPETITOR', goal: 'brand awareness' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!form.postContent) return toast.error('Paste the target post content');
    setLoading(true);
    try {
      const r = await api.post('/api/social/comments/generate', { clientId, ...form });
      setResult(r.data);
      toast.success('Comments generated!');
    } catch { toast.error('Generation failed'); }
    finally { setLoading(false); }
  };

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied!'); };

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Generate Strategic Comments</h3>
        <textarea value={form.postContent} onChange={(e) => setForm({ ...form, postContent: e.target.value })}
          placeholder="Paste the target post caption/content here..."
          rows={4}
          className="w-full bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500 resize-none" />
        <div className="flex gap-3">
          <select value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}
            className="flex-1 bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500">
            {['COMPETITOR', 'INFLUENCER', 'HASHTAG', 'TRENDING'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })}
            className="flex-1 bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500">
            {['brand awareness', 'lead gen', 'traffic', 'engagement'].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <button onClick={generate} disabled={loading}
          className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <LoadingSpinner size="sm" /> : <MessageSquare size={16} />}
          {loading ? 'Generating...' : 'Generate Comments'}
        </button>
      </div>

      {result && (
        <div className="space-y-3">
          {result.comments?.map((c, i) => (
            <div key={i} className={`card p-4 ${i === result.bestComment ? 'border border-brand-600/50' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {i === result.bestComment && <span className="text-xs text-brand-400 font-medium">⭐ Best</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.riskLevel === 'LOW' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                    {c.riskLevel} risk
                  </span>
                </div>
                <button onClick={() => copy(c.text)} className="text-slate-500 hover:text-white"><Copy size={14} /></button>
              </div>
              <p className="text-sm text-slate-200 mb-2">{c.text}</p>
              <p className="text-xs text-slate-500">{c.strategy}</p>
            </div>
          ))}
          {result.avoid && (
            <div className="bg-red-900/10 border border-red-700/20 rounded-lg p-3 text-xs text-red-400">
              ⚠ Avoid: {result.avoid}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Growth Advisor Tab ───────────────────────────────────────────────────────
function GrowthTab({ clientId }) {
  const [advice, setAdvice] = useState(null);
  const [form, setForm] = useState({ followers: '', reach: '', engagementRate: '', topContent: '', weakArea: '', goals: '' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api.get(`/api/social/growth/latest/${clientId}`).then((r) => setAdvice(r.data)).catch(() => {}).finally(() => setFetching(false));
  }, [clientId]);

  const generate = async () => {
    setLoading(true);
    try {
      const r = await api.post(`/api/social/growth/advise/${clientId}`, form);
      setAdvice(r.data);
      toast.success('Growth plan generated!');
    } catch { toast.error('Generation failed'); }
    finally { setLoading(false); }
  };

  if (fetching) return <div className="flex justify-center py-10"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      {advice && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">30-Day Growth Plan</h3>
              <span className="text-xs text-slate-400">{advice.month}/{advice.year}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center bg-slate-800 rounded-lg p-3">
                <p className="text-2xl font-bold text-brand-400">{advice.currentScore}</p>
                <p className="text-xs text-slate-500">Score</p>
              </div>
              <div className="text-center bg-slate-800 rounded-lg p-3">
                <p className="text-sm font-bold text-white">{advice.monthlyGoal?.followers}</p>
                <p className="text-xs text-slate-500">Follower Goal</p>
              </div>
              <div className="text-center bg-slate-800 rounded-lg p-3">
                <p className="text-sm font-bold text-white">{advice.monthlyGoal?.engagement}</p>
                <p className="text-xs text-slate-500">ER Goal</p>
              </div>
            </div>
            {advice.biggestOpportunity && (
              <div className="bg-green-900/10 border border-green-700/20 rounded-lg p-3 mb-3 text-xs">
                <p className="text-green-400 font-medium mb-0.5">Biggest Opportunity</p>
                <p className="text-slate-300">{advice.biggestOpportunity}</p>
              </div>
            )}
            {advice.biggestThreat && (
              <div className="bg-red-900/10 border border-red-700/20 rounded-lg p-3 text-xs">
                <p className="text-red-400 font-medium mb-0.5">Watch Out For</p>
                <p className="text-slate-300">{advice.biggestThreat}</p>
              </div>
            )}
          </div>

          {advice.weeklyPlan?.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Weekly Action Plan</h3>
              <div className="space-y-3">
                {advice.weeklyPlan.map((w) => (
                  <div key={w.week} className="bg-slate-800 rounded-lg p-3">
                    <p className="text-xs font-semibold text-brand-400 mb-1">Week {w.week} — {w.focus}</p>
                    <p className="text-xs text-slate-400 mb-2">{w.contentStrategy}</p>
                    {w.actions?.map((a, i) => (
                      <p key={i} className="text-xs text-slate-300 mb-0.5">• {a}</p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {advice.quickWins?.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Quick Wins</h3>
              {advice.quickWins.map((q, i) => (
                <p key={i} className="text-sm text-green-400 mb-1 flex items-start gap-2">
                  <CheckCircle size={14} className="mt-0.5 shrink-0" /> <span className="text-slate-300">{q}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">{advice ? 'Regenerate Plan' : 'Generate Growth Plan'}</h3>
        <div className="grid grid-cols-2 gap-3">
          {[['followers', 'Current followers'], ['reach', 'Monthly reach'], ['engagementRate', 'Avg ER %'], ['topContent', 'Top content type'], ['weakArea', 'Weakest area'], ['goals', 'Goals this month']].map(([k, p]) => (
            <input key={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={p}
              className="bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500" />
          ))}
        </div>
        <button onClick={generate} disabled={loading}
          className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <LoadingSpinner size="sm" /> : <TrendingUp size={16} />}
          {loading ? 'Generating...' : 'Generate 30-Day Growth Plan'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProtectionTools() {
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
          <h1 className="text-xl font-bold text-white">Protection & Growth</h1>
          <p className="text-slate-400 text-sm">{client?.name} · Brand safety + strategy</p>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${tab === i ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && <CrisisTab clientId={clientId} />}
      {tab === 1 && <CommentsTab clientId={clientId} />}
      {tab === 2 && <GrowthTab clientId={clientId} />}
    </div>
  );
}

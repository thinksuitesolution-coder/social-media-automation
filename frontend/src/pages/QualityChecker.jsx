import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import api from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

function ScoreBar({ label, score, color }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <span className={`text-xs font-semibold ${color}`}>{score}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function QualityChecker() {
  const { clientId } = useParams();
  const [form, setForm] = useState({ caption: '', hashtags: '', platform: 'instagram' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    if (!form.caption.trim()) return toast.error('Enter a caption to check');
    setLoading(true);
    try {
      const r = await api.post('/api/social/quality/check-text', { ...form, clientId });
      setResult(r.data);
    } catch { toast.error('Quality check failed'); }
    finally { setLoading(false); }
  };

  const scoreColor = (s) => s >= 80 ? 'text-green-400' : s >= 60 ? 'text-yellow-400' : 'text-red-400';
  const overallColor = result ? scoreColor(result.overallScore) : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/clients/${clientId}`} className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Quality Checker</h1>
          <p className="text-slate-400 text-sm">AI reviews every post before it goes live</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5 space-y-4">
          <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}
            className="w-full bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500">
            {['instagram', 'facebook', 'twitter', 'linkedin'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <textarea value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })}
            placeholder="Paste your caption here..."
            rows={8}
            className="w-full bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500 resize-none" />
          <input value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })}
            placeholder="#hashtag1 #hashtag2 ..."
            className="w-full bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500" />
          <button onClick={check} disabled={loading}
            className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <LoadingSpinner size="sm" /> : <ShieldCheck size={16} />}
            {loading ? 'Checking...' : 'Run Quality Check'}
          </button>
        </div>

        {result && (
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className={`text-3xl font-bold ${overallColor}`}>{result.overallScore}</p>
                  <p className="text-xs text-slate-400">Overall Score</p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${result.passed ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                  {result.passed ? <CheckCircle size={24} className="text-green-400" /> : <XCircle size={24} className="text-red-400" />}
                </div>
              </div>
              <div className="space-y-3">
                {[
                  ['Grammar', result.grammarScore],
                  ['Clarity', result.clarityScore],
                  ['Brand Alignment', result.brandAlignScore],
                  ['Sensitivity', result.sensitivityScore],
                ].map(([l, s]) => <ScoreBar key={l} label={l} score={s} color={scoreColor(s)} />)}
              </div>
              {result.spamScore > 20 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-yellow-400">
                  <AlertCircle size={14} /> Spam score: {result.spamScore} — reduce promotional language
                </div>
              )}
            </div>

            {result.criticalIssues?.length > 0 && (
              <div className="card p-4 border border-red-700/30">
                <p className="text-xs font-semibold text-red-400 mb-2">Critical Issues (must fix)</p>
                {result.criticalIssues.map((i, idx) => (
                  <p key={idx} className="text-sm text-slate-300 mb-1">• {i}</p>
                ))}
              </div>
            )}

            {result.suggestions?.length > 0 && (
              <div className="card p-4">
                <p className="text-xs font-semibold text-slate-400 mb-2">Suggestions</p>
                {result.suggestions.map((s, i) => (
                  <p key={i} className="text-sm text-slate-300 mb-1">• {s}</p>
                ))}
              </div>
            )}

            {result.fixedCaption && (
              <div className="card p-4">
                <p className="text-xs font-semibold text-green-400 mb-2">AI-Fixed Caption</p>
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{result.fixedCaption}</p>
                <button onClick={() => { setForm((f) => ({ ...f, caption: result.fixedCaption })); setResult(null); }}
                  className="mt-3 text-xs text-brand-400 hover:text-brand-300">
                  Use this version →
                </button>
              </div>
            )}
          </div>
        )}

        {!result && (
          <div className="card p-10 text-center">
            <ShieldCheck size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Paste your caption and run a quality check before posting</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-500">
              <div className="bg-slate-800 rounded-lg p-3">✅ Grammar check</div>
              <div className="bg-slate-800 rounded-lg p-3">🚫 Spam detect</div>
              <div className="bg-slate-800 rounded-lg p-3">🎯 Brand align</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

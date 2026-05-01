import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Star, Calendar, Sparkles } from 'lucide-react';
import api from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const TYPE_COLORS = { HIGH: 'text-yellow-400', MEDIUM: 'text-blue-400', LOW: 'text-slate-400' };
const TYPE_BADGES = { NATIONAL: 'bg-orange-900/40 text-orange-400', RELIGIOUS: 'bg-purple-900/40 text-purple-400', CULTURAL: 'bg-pink-900/40 text-pink-400', AWARENESS: 'bg-green-900/40 text-green-400', FUN: 'bg-yellow-900/40 text-yellow-400' };

export default function FestivalEngine() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/api/social/clients/${clientId}`),
      api.get('/api/social/festival/upcoming?days=60'),
      api.get(`/api/social/festival/client/${clientId}`),
    ]).then(([c, u, h]) => {
      setClient(c.data);
      setUpcoming(u.data);
      setHistory(h.data);
    }).catch(() => {});
  }, [clientId]);

  const generate = async () => {
    if (!selected) return toast.error('Select a festival first');
    setLoading(true);
    try {
      const r = await api.post('/api/social/festival/generate', {
        clientId, festivalName: selected.name, festivalDate: selected.date,
      });
      setResult(r.data);
      setHistory((h) => [{ ...r.data, festivalName: selected.name }, ...h]);
      toast.success('Festival content generated!');
    } catch { toast.error('Generation failed'); }
    finally { setLoading(false); }
  };

  const daysUntil = (date) => {
    const diff = new Date(date) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/clients/${clientId}`} className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Festival Content Engine</h1>
          <p className="text-slate-400 text-sm">{client?.name} · Never miss an Indian festival</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Festivals */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Calendar size={16} className="text-brand-400" /> Upcoming Festivals (60 days)
            </h2>
          </div>
          <div className="divide-y divide-slate-800 max-h-96 overflow-y-auto">
            {upcoming.map((f) => (
              <button key={f.name + f.date} onClick={() => { setSelected(f); setResult(null); }}
                className={`w-full text-left px-5 py-3 hover:bg-slate-800/50 transition-colors ${selected?.name === f.name ? 'bg-brand-600/10 border-l-2 border-brand-600' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{f.name}</p>
                    <p className="text-xs text-slate-400">{new Date(f.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs ${TYPE_COLORS[f.importance]}`}>{f.importance}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_BADGES[f.type] || 'bg-slate-800 text-slate-400'}`}>{f.type}</span>
                    <span className="text-xs text-slate-500">{daysUntil(f.date)}d away</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {selected && (
            <div className="p-5 border-t border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-white">Selected: {selected.name}</p>
              </div>
              <button onClick={generate} disabled={loading}
                className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <LoadingSpinner size="sm" /> : <Sparkles size={16} />}
                {loading ? 'Generating...' : 'Generate Festival Content Series'}
              </button>
            </div>
          )}
        </div>

        {/* Content Result / History */}
        <div className="space-y-4">
          {result && (
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Star size={16} className="text-yellow-400" /> 3-Post Series
                {!result.safeForBrand && <span className="text-xs text-red-400">⚠ Review sensitivity note</span>}
              </h3>
              {result.sensitivityNote && (
                <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 text-xs text-yellow-400">
                  {result.sensitivityNote}
                </div>
              )}
              {result.series?.map((post, i) => (
                <div key={i} className="bg-slate-800 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${post.type === 'MAIN' ? 'bg-brand-600/30 text-brand-400' : 'bg-slate-700 text-slate-400'}`}>
                      {post.type}
                    </span>
                    <span className="text-xs text-slate-500">{post.day} · {post.contentType}</span>
                  </div>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap">{post.caption}</p>
                  {post.imagePrompt && (
                    <p className="text-xs text-slate-500 italic">🎨 {post.imagePrompt}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {!result && history.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Past Festival Content</h3>
              <div className="space-y-2">
                {history.slice(0, 5).map((h) => (
                  <button key={h.id} onClick={() => setResult(h)}
                    className="w-full text-left px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300">
                    {h.festivalName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!result && history.length === 0 && !selected && (
            <div className="card p-10 text-center">
              <Star size={32} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Select a festival from the list to generate a 3-post content series</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

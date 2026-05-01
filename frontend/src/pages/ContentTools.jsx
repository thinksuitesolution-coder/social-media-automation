import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Share2, Video, Copy } from 'lucide-react';
import api from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const TABS = ['Repurpose Content', 'Multi-Platform Captions', 'Video Scripts'];

// ─── Repurpose Tab ────────────────────────────────────────────────────────────
function RepurposeTab({ clientId }) {
  const [type, setType] = useState('text');
  const [content, setContent] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get(`/api/social/repurpose/${clientId}`).then((r) => setHistory(r.data)).catch(() => {});
  }, [clientId]);

  const repurpose = async () => {
    if (!content.trim()) return toast.error('Enter content to repurpose');
    setLoading(true);
    try {
      const endpoint = type === 'blog' ? '/api/social/repurpose/blog' : type === 'old-post' ? '/api/social/repurpose/old-post' : '/api/social/repurpose/text';
      const payload = type === 'old-post' ? { clientId, originalCaption: content } : { clientId, content };
      const r = await api.post(endpoint, payload);
      setResult(r.data);
      toast.success('Content repurposed!');
    } catch { toast.error('Repurposing failed'); }
    finally { setLoading(false); }
  };

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied!'); };

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-4">
        <div className="flex gap-2">
          {[['text', 'Caption/Post'], ['blog', 'Blog Post'], ['old-post', 'Old Viral Post']].map(([v, l]) => (
            <button key={v} onClick={() => setType(v)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${type === v ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {l}
            </button>
          ))}
        </div>
        <textarea value={content} onChange={(e) => setContent(e.target.value)}
          placeholder={type === 'blog' ? 'Paste your blog post content here...' : type === 'old-post' ? 'Paste the old viral caption...' : 'Paste any caption or content to repurpose...'}
          rows={6}
          className="w-full bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500 resize-none" />
        <button onClick={repurpose} disabled={loading}
          className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <LoadingSpinner size="sm" /> : <Share2 size={16} />}
          {loading ? 'Repurposing...' : 'Repurpose Content'}
        </button>
      </div>

      {result && (
        <div className="space-y-3">
          {result.instagramPost && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-brand-400">Instagram Post</p>
                <button onClick={() => copy(result.instagramPost.caption)} className="text-slate-500 hover:text-white"><Copy size={14} /></button>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{result.instagramPost.caption}</p>
            </div>
          )}
          {result.twitterThread?.tweets && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-blue-400">Twitter Thread</p>
                <button onClick={() => copy(result.twitterThread.tweets.join('\n\n'))} className="text-slate-500 hover:text-white"><Copy size={14} /></button>
              </div>
              {result.twitterThread.tweets.map((t, i) => (
                <p key={i} className="text-sm text-slate-200 mb-2 pb-2 border-b border-slate-800 last:border-0">{i + 1}/ {t}</p>
              ))}
            </div>
          )}
          {result.linkedinPost && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-sky-400">LinkedIn</p>
                <button onClick={() => copy(result.linkedinPost.caption)} className="text-slate-500 hover:text-white"><Copy size={14} /></button>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{result.linkedinPost.caption}</p>
            </div>
          )}
          {result.reelScript && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-purple-400 mb-2">Reel Script</p>
              <p className="text-xs text-slate-500 mb-1">Hook</p>
              <p className="text-sm text-slate-200 mb-3">{result.reelScript.hook}</p>
              <p className="text-xs text-slate-500 mb-1">CTA</p>
              <p className="text-sm text-slate-200">{result.reelScript.cta}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Platform Captions Tab ────────────────────────────────────────────────────
function PlatformCaptionTab({ clientId }) {
  const [form, setForm] = useState({ topic: '', coreMessage: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!form.topic) return toast.error('Enter a topic');
    setLoading(true);
    try {
      const r = await api.post('/api/social/platform-caption/generate', { clientId, ...form });
      setResult(r.data);
      toast.success('Captions generated!');
    } catch { toast.error('Generation failed'); }
    finally { setLoading(false); }
  };

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied!'); };

  const platforms = result ? [
    { key: 'instagram', label: 'Instagram', color: 'text-pink-400' },
    { key: 'facebook', label: 'Facebook', color: 'text-blue-400' },
    { key: 'twitter', label: 'Twitter / X', color: 'text-sky-400' },
    { key: 'linkedin', label: 'LinkedIn', color: 'text-blue-300' },
  ] : [];

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-4">
        <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Topic (e.g. New product launch)"
          className="w-full bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500" />
        <input value={form.coreMessage} onChange={(e) => setForm({ ...form, coreMessage: e.target.value })} placeholder="Core message (optional)"
          className="w-full bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500" />
        <button onClick={generate} disabled={loading}
          className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <LoadingSpinner size="sm" /> : <Share2 size={16} />}
          {loading ? 'Generating...' : 'Generate for All Platforms'}
        </button>
      </div>

      {result && (
        <div className="space-y-3">
          {platforms.map(({ key, label, color }) => result[key] && (
            <div key={key} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xs font-semibold ${color}`}>{label}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{result[key].characterCount || result[key].caption?.length} chars</span>
                  <button onClick={() => copy(result[key].caption)} className="text-slate-500 hover:text-white"><Copy size={14} /></button>
                </div>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{result[key].caption}</p>
              {result[key].hashtags && <p className="text-xs text-slate-500 mt-2">{result[key].hashtags}</p>}
            </div>
          ))}
          {result.twitterThread?.tweets && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-sky-400">Twitter Thread</p>
                <button onClick={() => copy(result.twitterThread.tweets.join('\n\n'))} className="text-slate-500 hover:text-white"><Copy size={14} /></button>
              </div>
              {result.twitterThread.tweets.map((t, i) => (
                <p key={i} className="text-sm text-slate-200 mb-2 pb-2 border-b border-slate-800 last:border-0">{i + 1}/ {t}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Video Script Tab ─────────────────────────────────────────────────────────
function VideoScriptTab({ clientId }) {
  const [form, setForm] = useState({ topic: '', duration: '30', platform: 'instagram' });
  const [scripts, setScripts] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get(`/api/social/video-script/${clientId}`).then((r) => setScripts(r.data)).catch(() => {});
  }, [clientId]);

  const generate = async () => {
    if (!form.topic) return toast.error('Enter a topic');
    setLoading(true);
    try {
      const r = await api.post('/api/social/video-script/generate', { clientId, ...form, duration: parseInt(form.duration) });
      setResult(r.data);
      setScripts((s) => [r.data, ...s]);
      toast.success('Script generated!');
    } catch { toast.error('Generation failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-4">
        <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Video topic"
          className="w-full bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500" />
        <div className="flex gap-3">
          <select value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}
            className="flex-1 bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500">
            {['15', '30', '60', '90'].map((d) => <option key={d} value={d}>{d}s</option>)}
          </select>
          <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}
            className="flex-1 bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500">
            {['instagram', 'youtube', 'tiktok'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <button onClick={generate} disabled={loading}
          className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <LoadingSpinner size="sm" /> : <Video size={16} />}
          {loading ? 'Writing Script...' : 'Generate Video Script'}
        </button>
      </div>

      {result && (
        <div className="card p-5 space-y-4">
          <div className="bg-brand-600/10 border border-brand-600/30 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Hook (0-3 sec)</p>
            <p className="text-sm text-white font-medium">{result.hook}</p>
            {result.hookOnScreen && <p className="text-xs text-brand-400 mt-1">On screen: "{result.hookOnScreen}"</p>}
          </div>
          <div className="space-y-2">
            {result.scenes?.map((s, i) => (
              <div key={i} className="bg-slate-800 rounded-lg p-3 text-xs">
                <p className="text-slate-500 mb-1">{s.timeStamp}</p>
                <p className="text-slate-200 mb-1">{s.voiceover}</p>
                {s.onScreenText && <p className="text-brand-400">📱 {s.onScreenText}</p>}
                {s.visualDescription && <p className="text-slate-400 mt-1">🎬 {s.visualDescription}</p>}
              </div>
            ))}
          </div>
          <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">CTA</p>
            <p className="text-sm text-white">{result.cta}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-2">Alternative Hooks</p>
            {result.viralHooks?.map((h, i) => (
              <p key={i} className="text-xs text-slate-300 mb-1">• {h}</p>
            ))}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>🎵 {result.musicMood}</span>
            <span>⏱ {result.totalDuration}s</span>
            {result.thumbnailText && <span>📌 "{result.thumbnailText}"</span>}
          </div>
        </div>
      )}

      {scripts.length > 1 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Past Scripts</h3>
          <div className="space-y-2">
            {scripts.slice(1, 6).map((s) => (
              <button key={s.id} onClick={() => setResult(s)}
                className="w-full text-left px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 flex items-center justify-between">
                <span>{s.topic}</span>
                <span className="text-xs text-slate-500">{s.duration}s</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ContentTools() {
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
          <h1 className="text-xl font-bold text-white">Content Tools</h1>
          <p className="text-slate-400 text-sm">{client?.name} · AI-powered content engine</p>
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

      {tab === 0 && <RepurposeTab clientId={clientId} />}
      {tab === 1 && <PlatformCaptionTab clientId={clientId} />}
      {tab === 2 && <VideoScriptTab clientId={clientId} />}
    </div>
  );
}

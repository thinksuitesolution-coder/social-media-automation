import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Brain, Image, Users, ChevronRight, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const TABS = ['Brand Voice', 'Visual Style', 'Audience Persona'];

// ─── Brand Voice Tab ─────────────────────────────────────────────────────────
function VoiceTab({ clientId }) {
  const [voice, setVoice] = useState(null);
  const [captions, setCaptions] = useState('');
  const [testTopic, setTestTopic] = useState('');
  const [testResult, setTestResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api.get(`/api/social/voice/${clientId}`).then((r) => setVoice(r.data)).catch(() => {}).finally(() => setFetching(false));
  }, [clientId]);

  const train = async () => {
    const lines = captions.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) return toast.error('Add at least 3 captions (one per line)');
    setLoading(true);
    try {
      const r = await api.post(`/api/social/voice/train/${clientId}`, { sampleCaptions: lines });
      setVoice(r.data);
      toast.success('Brand voice trained!');
    } catch { toast.error('Training failed'); }
    finally { setLoading(false); }
  };

  const testVoice = async () => {
    if (!testTopic) return toast.error('Enter a topic');
    setLoading(true);
    try {
      const r = await api.post(`/api/social/voice/test/${clientId}`, { topic: testTopic });
      setTestResult(r.data.caption);
    } catch { toast.error('Test failed'); }
    finally { setLoading(false); }
  };

  if (fetching) return <div className="flex justify-center py-10"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      {voice && voice.trainingStatus === 'TRAINED' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400" /> Voice Trained
            </h3>
            <span className="text-xs text-green-400 font-medium">{voice.accuracy}% accuracy</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-slate-500 mb-1">Tone Words</p><p className="text-slate-300">{voice.toneWords?.join(', ')}</p></div>
            <div><p className="text-slate-500 mb-1">Emoji Usage</p><p className="text-slate-300">{voice.emojiUsage}</p></div>
            <div><p className="text-slate-500 mb-1">Sentence Style</p><p className="text-slate-300">{voice.sentenceStyle}</p></div>
            <div><p className="text-slate-500 mb-1">Avg Length</p><p className="text-slate-300">{voice.avgCaptionLength} chars</p></div>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-1">Avoid Words</p>
            <p className="text-slate-300 text-xs">{voice.avoidWords?.join(', ')}</p>
          </div>
          <div className="border-t border-slate-800 pt-4">
            <p className="text-slate-500 text-xs mb-2">Test Voice</p>
            <div className="flex gap-2">
              <input value={testTopic} onChange={(e) => setTestTopic(e.target.value)} placeholder="Enter topic to test..."
                className="flex-1 bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500" />
              <button onClick={testVoice} disabled={loading}
                className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50">
                Test
              </button>
            </div>
            {testResult && (
              <div className="mt-3 bg-slate-800 rounded-lg p-3 text-sm text-slate-200 whitespace-pre-wrap">{testResult}</div>
            )}
          </div>
        </div>
      )}

      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">{voice ? 'Retrain Voice' : 'Train Brand Voice'}</h3>
        <p className="text-xs text-slate-400">Paste 5-20 past captions, one per line. AI will learn the exact writing style.</p>
        <textarea
          value={captions} onChange={(e) => setCaptions(e.target.value)}
          placeholder="Caption 1&#10;Caption 2&#10;Caption 3&#10;..."
          rows={8}
          className="w-full bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500 resize-none"
        />
        <button onClick={train} disabled={loading}
          className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <LoadingSpinner size="sm" /> : <Brain size={16} />}
          {loading ? 'Training...' : 'Train Brand Voice'}
        </button>
      </div>
    </div>
  );
}

// ─── Visual Style Tab ─────────────────────────────────────────────────────────
function VisualTab({ clientId }) {
  const [style, setStyle] = useState(null);
  const [urls, setUrls] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api.get(`/api/social/visual-style/${clientId}`).then((r) => setStyle(r.data)).catch(() => {}).finally(() => setFetching(false));
  }, [clientId]);

  const train = async () => {
    const lines = urls.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return toast.error('Add at least 2 image URLs or descriptions');
    setLoading(true);
    try {
      const r = await api.post(`/api/social/visual-style/train/${clientId}`, { imageUrls: lines, referenceDescription: desc });
      setStyle(r.data);
      toast.success('Visual style trained!');
    } catch { toast.error('Training failed'); }
    finally { setLoading(false); }
  };

  if (fetching) return <div className="flex justify-center py-10"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      {style && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <CheckCircle size={16} className="text-green-400" /> Visual Style Trained
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-slate-500 mb-1">Visual Mood</p><p className="text-slate-300">{style.visualMood}</p></div>
            <div><p className="text-slate-500 mb-1">Image Style</p><p className="text-slate-300">{style.imageStyle}</p></div>
            <div><p className="text-slate-500 mb-1">Lighting</p><p className="text-slate-300">{style.lightingStyle}</p></div>
            <div><p className="text-slate-500 mb-1">Composition</p><p className="text-slate-300">{style.compositionStyle}</p></div>
          </div>
          {style.primaryColors?.length > 0 && (
            <div>
              <p className="text-slate-500 text-xs mb-2">Primary Colors</p>
              <div className="flex gap-2">
                {style.primaryColors.map((c) => (
                  <div key={c} className="flex items-center gap-1">
                    <div className="w-5 h-5 rounded" style={{ background: c }} />
                    <span className="text-xs text-slate-400">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-slate-500 text-xs mb-1">Master Image Prompt</p>
            <p className="text-slate-300 text-xs bg-slate-800 p-3 rounded-lg">{style.masterImagePrompt}</p>
          </div>
        </div>
      )}

      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">{style ? 'Update Visual Style' : 'Train Visual Style'}</h3>
        <p className="text-xs text-slate-400">Paste image URLs or describe reference images (one per line). AI extracts the visual brand identity.</p>
        <textarea value={urls} onChange={(e) => setUrls(e.target.value)}
          placeholder="https://... or 'bright studio photo with white background and product centered'&#10;https://... or another description"
          rows={5}
          className="w-full bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500 resize-none" />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Additional context (optional)..."
          className="w-full bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500" />
        <button onClick={train} disabled={loading}
          className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <LoadingSpinner size="sm" /> : <Image size={16} />}
          {loading ? 'Analyzing...' : 'Train Visual Style'}
        </button>
      </div>
    </div>
  );
}

// ─── Persona Tab ──────────────────────────────────────────────────────────────
function PersonaTab({ clientId }) {
  const [personas, setPersonas] = useState([]);
  const [form, setForm] = useState({ product: '', priceRange: '', location: 'India', topContent: '' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const load = () => {
    setFetching(true);
    api.get(`/api/social/persona/${clientId}`).then((r) => setPersonas(r.data)).catch(() => {}).finally(() => setFetching(false));
  };
  useEffect(load, [clientId]);

  const build = async () => {
    setLoading(true);
    try {
      const r = await api.post(`/api/social/persona/build/${clientId}`, form);
      setPersonas((p) => [r.data, ...p]);
      toast.success('Persona built!');
    } catch { toast.error('Failed to build persona'); }
    finally { setLoading(false); }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/api/social/persona/${id}`);
      setPersonas((p) => p.filter((x) => x.id !== id));
      toast.success('Persona deleted');
    } catch { toast.error('Delete failed'); }
  };

  if (fetching) return <div className="flex justify-center py-10"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      {personas.map((p) => (
        <div key={p.id} className="card p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">{p.personaName}</h3>
              <p className="text-xs text-slate-400">{p.age} · {p.gender} · {p.incomeLevel}</p>
            </div>
            <button onClick={() => remove(p.id)} className="text-slate-600 hover:text-red-400 text-xs">Delete</button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-slate-500 mb-1">Location</p><p className="text-slate-300">{p.location?.join(', ')}</p></div>
            <div><p className="text-slate-500 mb-1">Language</p><p className="text-slate-300">{p.language}</p></div>
            <div><p className="text-slate-500 mb-1">Platforms</p><p className="text-slate-300">{p.platforms?.join(', ')}</p></div>
            <div><p className="text-slate-500 mb-1">Active Hours</p><p className="text-slate-300">{p.activeHours?.join(', ')}</p></div>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-1">Pain Points</p>
            <p className="text-slate-300 text-xs">{p.painPoints?.join(' · ')}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-1">Content Angles</p>
            <p className="text-slate-300 text-xs">{p.contentAngles?.join(' · ')}</p>
          </div>
        </div>
      ))}

      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Build New Persona</h3>
        <div className="grid grid-cols-2 gap-3">
          <input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="Product/Service"
            className="bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500" />
          <input value={form.priceRange} onChange={(e) => setForm({ ...form, priceRange: e.target.value })} placeholder="Price Range (e.g. ₹500-2000)"
            className="bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500" />
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location"
            className="bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500" />
          <input value={form.topContent} onChange={(e) => setForm({ ...form, topContent: e.target.value })} placeholder="Top performing content type"
            className="bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-brand-500" />
        </div>
        <button onClick={build} disabled={loading}
          className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <LoadingSpinner size="sm" /> : <Users size={16} />}
          {loading ? 'Building...' : 'Build Audience Persona'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BrandIntelligence() {
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
          <h1 className="text-xl font-bold text-white">Brand Intelligence</h1>
          <p className="text-slate-400 text-sm">{client?.name} · AI learns your brand identity</p>
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

      {tab === 0 && <VoiceTab clientId={clientId} />}
      {tab === 1 && <VisualTab clientId={clientId} />}
      {tab === 2 && <PersonaTab clientId={clientId} />}
    </div>
  );
}

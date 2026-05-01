import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users, Calendar, FileText, Settings, Trash2, ChevronRight, Globe, Bot } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { PROVIDERS, formatDate } from '../utils/helpers';
import BrandChatModal from '../components/BrandChatModal';

function ClientForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    name: '', niche: '', tone: '', targetAudience: '', whatsappNumber: '',
    instagramAccountId: '', instagramToken: '', defaultImageProvider: 'DALLE',
    websiteUrl: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = initial?.id
        ? await api.put(`/api/clients/${initial.id}`, form)
        : await api.post('/api/clients', form);
      onSave(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Brand Name *</label>
          <input className="input" value={form.name} onChange={set('name')} required placeholder="Acme Fashion" />
        </div>
        <div>
          <label className="label">Niche *</label>
          <input className="input" value={form.niche} onChange={set('niche')} required placeholder="Fashion, Tech, Food…" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Tone of Voice *</label>
          <input className="input" value={form.tone} onChange={set('tone')} required placeholder="Fun, Luxury, Professional…" />
        </div>
        <div>
          <label className="label">WhatsApp Number *</label>
          <input className="input" value={form.whatsappNumber} onChange={set('whatsappNumber')} required placeholder="+919876543210" />
        </div>
      </div>
      <div>
        <label className="label">Target Audience *</label>
        <input className="input" value={form.targetAudience} onChange={set('targetAudience')} required placeholder="Women 18-35 interested in sustainable fashion" />
      </div>
      <div>
        <label className="label">Website URL</label>
        <input className="input" value={form.websiteUrl} onChange={set('websiteUrl')} placeholder="https://yourbrand.com" type="url" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Instagram Account ID</label>
          <input className="input" value={form.instagramAccountId} onChange={set('instagramAccountId')} placeholder="17841400000000000" />
        </div>
        <div>
          <label className="label">Default Image AI</label>
          <select className="input" value={form.defaultImageProvider} onChange={set('defaultImageProvider')}>
            {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Instagram Access Token</label>
        <textarea className="input min-h-[70px] resize-none" value={form.instagramToken} onChange={set('instagramToken')} placeholder="Long-lived access token…" />
      </div>
      <div className="flex gap-3 justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading && <LoadingSpinner size="sm" />}
          {initial?.id ? 'Update Client' : 'Add Client'}
        </button>
      </div>
    </form>
  );
}

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [chatClient, setChatClient] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/api/clients')
      .then((r) => setClients(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const deleteClient = async (id, name) => {
    if (!confirm(`Delete client "${name}"? This will remove all their data.`)) return;
    try {
      await api.delete(`/api/clients/${id}`);
      setClients((c) => c.filter((x) => x.id !== id));
      toast.success('Client deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleSave = (client) => {
    const isNew = !editing;
    if (editing) {
      setClients((c) => c.map((x) => x.id === client.id ? client : x));
    } else {
      setClients((c) => [client, ...c]);
    }
    setShowForm(false);
    setEditing(null);
    toast.success(isNew ? 'Client added! Let\'s set up their brand strategy.' : 'Client updated');
    if (isNew) setChatClient(client);
  };

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.niche.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Clients</h1>
          <p className="text-slate-400 text-sm mt-0.5">{clients.length} total clients</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus size={16} /> Add Client
        </button>
      </div>

      {/* Form modal */}
      {(showForm || editing) && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && (setShowForm(false), setEditing(null))}>
          <div className="modal p-6">
            <h2 className="text-lg font-semibold text-white mb-5">{editing ? 'Edit Client' : 'Add New Client'}</h2>
            <ClientForm
              initial={editing}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditing(null); }}
            />
          </div>
        </div>
      )}

      {/* Brand onboarding chatbot */}
      {chatClient && (
        <BrandChatModal
          client={chatClient}
          onClose={() => setChatClient(null)}
          onComplete={(updatedClient) => {
            setClients((c) => c.map((x) => x.id === updatedClient.id ? { ...x, brandInfo: updatedClient.brandInfo } : x));
            setChatClient(null);
            toast.success('Brand strategy saved! Calendar generation will now be smarter.');
          }}
        />
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="input pl-9"
          placeholder="Search clients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Client list */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <Users size={40} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400">No clients yet. Add your first client.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((client) => (
            <div key={client.id} className="card p-5 hover:border-slate-700 transition-colors group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white">{client.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{client.niche} · {client.tone}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditing(client); setShowForm(false); }}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
                  >
                    <Settings size={14} />
                  </button>
                  <button
                    onClick={() => deleteClient(client.id, client.name)}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-400 mb-4 line-clamp-2">{client.targetAudience}</p>

              <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                <span className="bg-slate-800 px-2 py-0.5 rounded">{client._count?.posts || 0} posts</span>
                <span className="bg-slate-800 px-2 py-0.5 rounded">{client._count?.socialAccounts || 0} accounts</span>
                <span className="bg-slate-800 px-2 py-0.5 rounded">{client.defaultImageProvider}</span>
                {client.brandInfo
                  ? <span className="bg-green-900/40 text-green-400 px-2 py-0.5 rounded flex items-center gap-1"><Bot size={10} /> AI Ready</span>
                  : <button onClick={() => setChatClient(client)} className="bg-brand/20 text-brand px-2 py-0.5 rounded flex items-center gap-1 hover:bg-brand/30 transition-colors"><Bot size={10} /> Setup AI</button>
                }
              </div>

              <div className="flex gap-2">
                <Link to={`/clients/${client.id}`} className="btn-secondary btn-sm flex-1 justify-center">
                  <ChevronRight size={12} /> View
                </Link>
                <Link to={`/calendar/${client.id}`} className="btn-secondary btn-sm flex-1 justify-center">
                  <Calendar size={12} /> Calendar
                </Link>
                <Link to={`/posts/${client.id}`} className="btn-secondary btn-sm flex-1 justify-center">
                  <FileText size={12} /> Posts
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

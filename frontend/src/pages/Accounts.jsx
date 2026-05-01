import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, RefreshCw, Power, Trash2, AlertCircle, CheckCircle, Clock, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDate } from '../utils/helpers';

const PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'TWITTER', 'LINKEDIN'];

function AccountForm({ clientId, onSave, onCancel }) {
  const [form, setForm] = useState({
    platform: 'INSTAGRAM', accountId: '', accountName: '',
    profilePic: '', accessToken: '', refreshToken: '', tokenExpiry: '',
  });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/api/accounts/connect', { clientId, ...form });
      onSave(res.data);
      toast.success('Account connected');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to connect account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Platform *</label>
          <select className="input" value={form.platform} onChange={set('platform')}>
            {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Account Name *</label>
          <input className="input" value={form.accountName} onChange={set('accountName')} required placeholder="@mybrand" />
        </div>
      </div>
      <div>
        <label className="label">Platform Account ID *</label>
        <input className="input" value={form.accountId} onChange={set('accountId')} required placeholder="17841400000000000" />
      </div>
      <div>
        <label className="label">Access Token *</label>
        <textarea className="input min-h-[80px] resize-none" value={form.accessToken} onChange={set('accessToken')} required placeholder="Long-lived access token…" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Profile Picture URL</label>
          <input className="input" value={form.profilePic} onChange={set('profilePic')} placeholder="https://…" />
        </div>
        <div>
          <label className="label">Token Expiry</label>
          <input type="date" className="input" value={form.tokenExpiry} onChange={set('tokenExpiry')} />
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading && <LoadingSpinner size="sm" />}
          Connect Account
        </button>
      </div>
    </form>
  );
}

function TokenStatusIcon({ status }) {
  if (status === 'VALID') return <CheckCircle size={16} className="text-green-400" />;
  if (status === 'EXPIRING_SOON') return <Clock size={16} className="text-yellow-400" />;
  if (status === 'EXPIRED' || status === 'INVALID') return <AlertCircle size={16} className="text-red-400" />;
  return null;
}

export default function Accounts() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [healthData, setHealthData] = useState({});
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    api.get(`/api/social/clients/${clientId}`).then((r) => setClient(r.data));
    loadAccounts();
  }, [clientId]);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/accounts/${clientId}`);
      setAccounts(res.data);
    } catch { } finally {
      setLoading(false);
    }
  };

  const checkHealth = async (id) => {
    setActionLoading((l) => ({ ...l, [`health-${id}`]: true }));
    try {
      const res = await api.get(`/api/accounts/${id}/health`);
      setHealthData((h) => ({ ...h, [id]: res.data }));
    } catch {
      toast.error('Health check failed');
    } finally {
      setActionLoading((l) => ({ ...l, [`health-${id}`]: false }));
    }
  };

  const toggleAccount = async (id) => {
    setActionLoading((l) => ({ ...l, [`toggle-${id}`]: true }));
    try {
      const res = await api.put(`/api/accounts/${id}/toggle`);
      setAccounts((a) => a.map((x) => x.id === id ? res.data : x));
    } catch {
      toast.error('Toggle failed');
    } finally {
      setActionLoading((l) => ({ ...l, [`toggle-${id}`]: false }));
    }
  };

  const refreshToken = async (id) => {
    setActionLoading((l) => ({ ...l, [`refresh-${id}`]: true }));
    try {
      const res = await api.post(`/api/accounts/${id}/refresh`);
      setAccounts((a) => a.map((x) => x.id === id ? res.data : x));
      toast.success('Token refreshed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Refresh failed');
    } finally {
      setActionLoading((l) => ({ ...l, [`refresh-${id}`]: false }));
    }
  };

  const deleteAccount = async (id, name) => {
    if (!confirm(`Remove account "${name}"?`)) return;
    try {
      await api.delete(`/api/accounts/${id}`);
      setAccounts((a) => a.filter((x) => x.id !== id));
      toast.success('Account removed');
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/clients/${clientId}`} className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Social Accounts</h1>
          <p className="text-slate-400 text-sm">{client?.name}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Connect Account
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal p-6">
            <h2 className="text-lg font-semibold text-white mb-5">Connect Social Account</h2>
            <AccountForm
              clientId={clientId}
              onSave={(acc) => { setAccounts((a) => [acc, ...a]); setShowForm(false); }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : accounts.length === 0 ? (
        <div className="card p-16 text-center">
          <Activity size={40} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400">No accounts connected yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc) => {
            const health = healthData[acc.id];
            const expired = acc.tokenExpiry && new Date(acc.tokenExpiry) < new Date();
            const expiringSoon = acc.tokenExpiry && !expired &&
              (new Date(acc.tokenExpiry) - new Date()) < 7 * 24 * 60 * 60 * 1000;

            return (
              <div key={acc.id} className={`card p-5 ${!acc.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {acc.profilePic ? (
                      <img src={acc.profilePic} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300">
                        {acc.platform[0]}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{acc.accountName}</p>
                        {health && <TokenStatusIcon status={health.tokenStatus} />}
                      </div>
                      <p className="text-xs text-slate-500">{acc.platform} · ID: {acc.accountId}</p>
                      {acc.tokenExpiry && (
                        <p className={`text-xs mt-0.5 ${expired ? 'text-red-400' : expiringSoon ? 'text-yellow-400' : 'text-slate-500'}`}>
                          Token expires: {formatDate(acc.tokenExpiry)}
                          {expired && ' (EXPIRED)'}
                          {expiringSoon && ' (EXPIRING SOON)'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => checkHealth(acc.id)}
                      disabled={actionLoading[`health-${acc.id}`]}
                      className="btn-secondary btn-sm"
                      title="Check health"
                    >
                      {actionLoading[`health-${acc.id}`] ? <LoadingSpinner size="sm" /> : <Activity size={14} />}
                    </button>
                    {acc.platform === 'INSTAGRAM' && (
                      <button
                        onClick={() => refreshToken(acc.id)}
                        disabled={actionLoading[`refresh-${acc.id}`]}
                        className="btn-secondary btn-sm"
                        title="Refresh token"
                      >
                        {actionLoading[`refresh-${acc.id}`] ? <LoadingSpinner size="sm" /> : <RefreshCw size={14} />}
                      </button>
                    )}
                    <button
                      onClick={() => toggleAccount(acc.id)}
                      disabled={actionLoading[`toggle-${acc.id}`]}
                      className={`btn-sm ${acc.isActive ? 'btn-secondary' : 'btn-success'}`}
                      title={acc.isActive ? 'Disable' : 'Enable'}
                    >
                      {actionLoading[`toggle-${acc.id}`] ? <LoadingSpinner size="sm" /> : <Power size={14} />}
                    </button>
                    <button
                      onClick={() => deleteAccount(acc.id, acc.accountName)}
                      className="btn-secondary btn-sm text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Health details */}
                {health && (
                  <div className="mt-4 p-3 bg-slate-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-400">Account Health</span>
                      <span className={`text-xs font-medium ${
                        health.tokenStatus === 'VALID' ? 'text-green-400'
                        : health.tokenStatus === 'EXPIRING_SOON' ? 'text-yellow-400'
                        : 'text-red-400'
                      }`}>{health.tokenStatus}</span>
                    </div>
                    {health.daysUntilExpiry !== null && (
                      <p className="text-xs text-slate-500">
                        {health.daysUntilExpiry > 0
                          ? `Token expires in ${health.daysUntilExpiry} days`
                          : 'Token has expired'}
                      </p>
                    )}
                    {health.accountInfo && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {health.accountInfo.followers_count !== undefined && (
                          <div className="bg-slate-900 rounded-lg p-2 text-center">
                            <p className="text-sm font-bold text-white">{health.accountInfo.followers_count?.toLocaleString()}</p>
                            <p className="text-xs text-slate-500">Followers</p>
                          </div>
                        )}
                        {health.accountInfo.media_count !== undefined && (
                          <div className="bg-slate-900 rounded-lg p-2 text-center">
                            <p className="text-sm font-bold text-white">{health.accountInfo.media_count}</p>
                            <p className="text-xs text-slate-500">Posts</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

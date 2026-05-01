import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, FileText, Link2, ArrowLeft, Instagram, Phone } from 'lucide-react';
import api from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDate } from '../utils/helpers';

export default function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/clients/${id}`)
      .then((r) => setClient(r.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  if (!client) return <div className="text-center text-slate-400 py-20">Client not found</div>;

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/clients" className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">{client.name}</h1>
          <p className="text-slate-400 text-sm">{client.niche} · {client.tone}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Info card */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-white text-sm">Client Profile</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Target Audience</p>
              <p className="text-sm text-slate-200">{client.targetAudience}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Phone size={14} className="text-slate-500" />
              {client.whatsappNumber}
            </div>
            {client.instagramAccountId && (
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Instagram size={14} className="text-slate-500" />
                ID: {client.instagramAccountId}
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Default AI Provider</p>
              <p className="text-sm text-slate-200">{client.defaultImageProvider}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Added</p>
              <p className="text-sm text-slate-200">{formatDate(client.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-white text-sm">Quick Stats</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{client._count?.posts || 0}</p>
              <p className="text-xs text-slate-400 mt-0.5">Total Posts</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{client.socialAccounts?.length || 0}</p>
              <p className="text-xs text-slate-400 mt-0.5">Social Accounts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card p-5">
        <h2 className="font-semibold text-white text-sm mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Link
            to={`/calendar/${id}`}
            className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <Calendar size={20} className="text-brand-400" />
            <div>
              <p className="text-sm font-medium text-white">Content Calendar</p>
              <p className="text-xs text-slate-400">Generate & manage monthly content</p>
            </div>
          </Link>
          <Link
            to={`/posts/${id}`}
            className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <FileText size={20} className="text-green-400" />
            <div>
              <p className="text-sm font-medium text-white">Posts</p>
              <p className="text-xs text-slate-400">View & manage all posts</p>
            </div>
          </Link>
          <Link
            to={`/accounts/${id}`}
            className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <Link2 size={20} className="text-purple-400" />
            <div>
              <p className="text-sm font-medium text-white">Social Accounts</p>
              <p className="text-xs text-slate-400">Manage connected accounts</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Connected accounts */}
      {client.socialAccounts?.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-white text-sm mb-4">Connected Accounts</h2>
          <div className="space-y-2">
            {client.socialAccounts.map((acc) => {
              const expired = acc.tokenExpiry && new Date(acc.tokenExpiry) < new Date();
              const expiringSoon = acc.tokenExpiry && !expired &&
                (new Date(acc.tokenExpiry) - new Date()) < 7 * 24 * 60 * 60 * 1000;
              return (
                <div key={acc.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold text-slate-300">
                      {acc.platform[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{acc.accountName}</p>
                      <p className="text-xs text-slate-500">{acc.platform}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    expired ? 'bg-red-900/50 text-red-300'
                    : expiringSoon ? 'bg-yellow-900/50 text-yellow-300'
                    : 'bg-green-900/50 text-green-300'
                  }`}>
                    {expired ? 'Expired' : expiringSoon ? 'Expiring Soon' : 'Active'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

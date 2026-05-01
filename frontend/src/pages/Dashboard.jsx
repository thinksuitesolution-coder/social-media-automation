import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, FileText, Clock, CheckCircle, Activity, TrendingUp, ArrowRight } from 'lucide-react';
import api from '../utils/api';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDateTime, truncate } from '../utils/helpers';

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-slate-400 text-xs font-medium mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/clients/stats')
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-0.5">Overview of your social media automation</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Total Clients"      value={stats?.totalClients}      color="bg-brand-600"  />
        <StatCard icon={FileText}    label="Posts This Month"   value={stats?.postsThisMonth}    color="bg-blue-600"   />
        <StatCard icon={Clock}       label="Pending Approvals"  value={stats?.pendingApprovals}  color="bg-yellow-600" />
        <StatCard icon={CheckCircle} label="Posted Today"       value={stats?.postedToday}       color="bg-green-600"  />
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-slate-400" />
            <h2 className="font-medium text-white text-sm">Recent Activity</h2>
          </div>
          <Link to="/clients" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
            All clients <ArrowRight size={12} />
          </Link>
        </div>

        {stats?.recentPosts?.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">
            No posts yet. Add a client and generate content to get started.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {stats?.recentPosts?.map((post) => (
              <div key={post.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-800/30 transition-colors">
                {post.imageUrl && (
                  <img src={post.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 font-medium truncate">{post.topic}</p>
                  <p className="text-xs text-slate-500">{post.client?.name} · {formatDateTime(post.updatedAt)}</p>
                </div>
                <StatusBadge status={post.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

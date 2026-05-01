import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Filter, Grid, List, Image, ExternalLink } from 'lucide-react';
import api from '../utils/api';
import StatusBadge from '../components/StatusBadge';
import PostDetailModal from '../components/PostDetailModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDate, formatDateTime, truncate } from '../utils/helpers';

const STATUSES = ['ALL', 'PENDING', 'SENT', 'APPROVED', 'REJECTED', 'POSTED'];

export default function Posts() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedPost, setSelectedPost] = useState(null);
  const [view, setView] = useState('grid');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get(`/api/social/clients/${clientId}`).then((r) => setClient(r.data));
  }, [clientId]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 24 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const res = await api.get(`/api/posts/${clientId}`, { params });
      setPosts(res.data.posts);
      setTotal(res.data.total);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [clientId, statusFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handlePostUpdate = (updated) => {
    setPosts((p) => p.map((x) => x.id === updated.id ? updated : x));
    setSelectedPost(updated);
  };

  const openPost = async (post) => {
    try {
      const res = await api.get(`/api/posts/single/${post.id}`);
      setSelectedPost(res.data);
    } catch {
      setSelectedPost(post);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/clients/${clientId}`} className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Posts</h1>
          <p className="text-slate-400 text-sm">{client?.name} · {total} posts</p>
        </div>
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
          <button onClick={() => setView('grid')} className={`p-1.5 rounded ${view === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            <Grid size={16} />
          </button>
          <button onClick={() => setView('list')} className={`p-1.5 rounded ${view === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-brand-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {s === 'ALL' ? 'All Posts' : s}
          </button>
        ))}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : posts.length === 0 ? (
        <div className="card p-16 text-center">
          <Image size={40} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400">No posts found. Generate them from the calendar.</p>
          <Link to={`/calendar/${clientId}`} className="btn-primary mt-4 inline-flex mx-auto">
            Go to Calendar
          </Link>
        </div>
      ) : view === 'grid' ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {posts.map((post) => (
            <div
              key={post.id}
              onClick={() => openPost(post)}
              className="card overflow-hidden cursor-pointer hover:border-slate-600 transition-colors group"
            >
              <div className="relative aspect-square bg-slate-800">
                {post.imageUrl ? (
                  <img src={post.imageUrl} alt={post.topic} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <Image size={32} />
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <StatusBadge status={post.status} />
                </div>
                {post.instagramUrl && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={post.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 bg-black/60 rounded-lg text-white hover:bg-black/80 flex"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold text-slate-200 truncate">{post.topic}</p>
                <p className="text-xs text-slate-500 mt-0.5">{formatDate(post.scheduledTime || post.date)}</p>
                <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{truncate(post.caption, 80)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card divide-y divide-slate-800">
          {posts.map((post) => (
            <div
              key={post.id}
              onClick={() => openPost(post)}
              className="flex items-center gap-4 px-5 py-4 hover:bg-slate-800/30 cursor-pointer transition-colors"
            >
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                {post.imageUrl
                  ? <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Image size={20} className="text-slate-600" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{post.topic}</p>
                <p className="text-xs text-slate-400 mt-0.5">{truncate(post.caption, 100)}</p>
                <p className="text-xs text-slate-500 mt-1">{formatDateTime(post.scheduledTime || post.date)}</p>
              </div>
              <StatusBadge status={post.status} />
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 24 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary btn-sm"
          >
            Previous
          </button>
          <span className="text-xs text-slate-400 self-center px-3">
            Page {page} of {Math.ceil(total / 24)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 24)}
            className="btn-secondary btn-sm"
          >
            Next
          </button>
        </div>
      )}

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onUpdate={handlePostUpdate}
        />
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { X, RefreshCw, Send, Check, XCircle, Instagram, Zap, ExternalLink, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import StatusBadge from './StatusBadge';
import LoadingSpinner from './LoadingSpinner';
import { PROVIDERS, formatDateTime, truncate } from '../utils/helpers';

export default function PostDetailModal({ post, onClose, onUpdate }) {
  const [loading, setLoading] = useState({});
  const [imageProvider, setImageProvider] = useState(post.imageProvider || 'DALLE');
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [viralScore, setViralScore] = useState(null);

  const action = async (key, fn) => {
    setLoading((l) => ({ ...l, [key]: true }));
    try {
      const res = await fn();
      onUpdate(res.data);
      toast.success(`${key} successful`);
    } catch (err) {
      toast.error(err.response?.data?.error || `${key} failed`);
    } finally {
      setLoading((l) => ({ ...l, [key]: false }));
    }
  };

  const fetchViralScore = async () => {
    setLoading((l) => ({ ...l, viral: true }));
    try {
      const res = await api.get(`/api/posts/viral-score/${post.id}`);
      setViralScore(res.data);
    } catch {
      toast.error('Could not fetch viral score');
    } finally {
      setLoading((l) => ({ ...l, viral: false }));
    }
  };

  const copyCaption = () => {
    navigator.clipboard.writeText(`${post.caption}\n\n${post.hashtags}`);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div>
            <h2 className="font-semibold text-white">{post.topic}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(post.scheduledTime || post.date)}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={post.status} />
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Image */}
          <div className="relative group">
            <img
              src={post.imageUrl}
              alt={post.topic}
              className="w-full aspect-square object-cover rounded-xl border border-slate-700"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl transition-colors" />
          </div>

          {/* Image regeneration */}
          <div className="flex gap-2">
            <select
              value={imageProvider}
              onChange={(e) => setImageProvider(e.target.value)}
              className="input flex-1"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <button
              className="btn-secondary btn-sm"
              onClick={() => action('Regenerate image', () =>
                api.post(`/api/posts/regenerate-image/${post.id}`, { imageProvider })
              )}
              disabled={loading['Regenerate image']}
            >
              {loading['Regenerate image'] ? <LoadingSpinner size="sm" /> : <RefreshCw size={14} />}
              Image
            </button>
          </div>

          {/* Caption */}
          <div className="bg-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Caption</span>
              <div className="flex gap-2">
                <button onClick={copyCaption} className="text-slate-500 hover:text-slate-300">
                  <Copy size={14} />
                </button>
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => action('Regenerate caption', () =>
                    api.post(`/api/posts/regenerate-caption/${post.id}`)
                  )}
                  disabled={loading['Regenerate caption']}
                >
                  {loading['Regenerate caption'] ? <LoadingSpinner size="sm" /> : <RefreshCw size={14} />}
                  Caption
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">
              {showFullCaption ? post.caption : truncate(post.caption, 200)}
            </p>
            {post.caption?.length > 200 && (
              <button
                onClick={() => setShowFullCaption(!showFullCaption)}
                className="text-xs text-brand-400 hover:text-brand-300"
              >
                {showFullCaption ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          {/* Hashtags */}
          <div className="bg-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Hashtags</span>
              <button
                className="btn-secondary btn-sm"
                onClick={() => action('Regenerate hashtags', () =>
                  api.post(`/api/posts/regenerate-hashtags/${post.id}`)
                )}
                disabled={loading['Regenerate hashtags']}
              >
                {loading['Regenerate hashtags'] ? <LoadingSpinner size="sm" /> : <RefreshCw size={14} />}
                Hashtags
              </button>
            </div>
            <p className="text-xs text-blue-400 leading-relaxed">{post.hashtags}</p>
          </div>

          {/* Viral Score */}
          {viralScore ? (
            <div className="bg-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Viral Score</span>
                <span className={`text-2xl font-bold ${viralScore.score >= 70 ? 'text-green-400' : viralScore.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {viralScore.score}%
                </span>
              </div>
              <p className="text-xs text-slate-300 mb-2">{viralScore.reasoning}</p>
              {viralScore.improvements?.length > 0 && (
                <ul className="space-y-1">
                  {viralScore.improvements.map((imp, i) => (
                    <li key={i} className="text-xs text-slate-400 flex gap-2">
                      <span className="text-brand-400">→</span>{imp}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <button
              onClick={fetchViralScore}
              disabled={loading.viral}
              className="btn-secondary w-full justify-center"
            >
              {loading.viral ? <LoadingSpinner size="sm" /> : <Zap size={14} />}
              Check Viral Score
            </button>
          )}

          {/* Instagram link if posted */}
          {post.instagramUrl && (
            <a
              href={post.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-700/30 rounded-xl text-sm text-purple-300 hover:text-purple-200 transition-colors"
            >
              <Instagram size={16} />
              View on Instagram
              <ExternalLink size={12} className="ml-auto" />
            </a>
          )}
        </div>

        {/* Action buttons */}
        <div className="p-5 border-t border-slate-700 flex flex-wrap gap-2">
          {post.status === 'PENDING' && (
            <button
              className="btn-primary flex-1"
              onClick={() => action('Send to WhatsApp', () =>
                api.post(`/api/posts/send-whatsapp/${post.id}`)
              )}
              disabled={loading['Send to WhatsApp']}
            >
              {loading['Send to WhatsApp'] ? <LoadingSpinner size="sm" /> : <Send size={14} />}
              Send for Approval
            </button>
          )}

          {['PENDING', 'SENT', 'REJECTED'].includes(post.status) && (
            <button
              className="btn-success flex-1"
              onClick={() => action('Approve', () =>
                api.post(`/api/posts/approve/${post.id}`)
              )}
              disabled={loading.Approve}
            >
              {loading.Approve ? <LoadingSpinner size="sm" /> : <Check size={14} />}
              Approve
            </button>
          )}

          {['PENDING', 'SENT', 'APPROVED'].includes(post.status) && (
            <button
              className="btn-danger"
              onClick={() => action('Reject', () =>
                api.post(`/api/posts/reject/${post.id}`)
              )}
              disabled={loading.Reject}
            >
              {loading.Reject ? <LoadingSpinner size="sm" /> : <XCircle size={14} />}
              Reject
            </button>
          )}

          {post.status === 'APPROVED' && (
            <button
              className="btn-primary flex-1"
              onClick={() => action('Post to Instagram', () =>
                api.post(`/api/posts/upload-instagram/${post.id}`)
              )}
              disabled={loading['Post to Instagram']}
            >
              {loading['Post to Instagram'] ? <LoadingSpinner size="sm" /> : <Instagram size={14} />}
              Post to Instagram
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

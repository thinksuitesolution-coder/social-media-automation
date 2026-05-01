import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Zap, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import StatusBadge from './StatusBadge';
import LoadingSpinner from './LoadingSpinner';
import PostDetailModal from './PostDetailModal';
import { CONTENT_TYPE_COLORS, MONTHS, getDaysInMonth, getFirstDayOfMonth } from '../utils/helpers';

export default function CalendarGrid({ calendar, clientId, month, year, onPostUpdate }) {
  const [loadingDay, setLoadingDay] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [editingDay, setEditingDay] = useState(null);

  if (!calendar) return null;

  const daysInMonth = getDaysInMonth(month, year);
  const firstDay = getFirstDayOfMonth(month, year);

  const dayMap = {};
  calendar.days.forEach((d) => {
    const key = new Date(d.date).getDate();
    dayMap[key] = d;
  });

  const generatePost = async (dayId, dayNum) => {
    setLoadingDay(dayNum);
    try {
      const res = await api.post(`/api/posts/generate/${dayId}`);
      toast.success('Post generated!');
      onPostUpdate?.(dayId, res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
    } finally {
      setLoadingDay(null);
    }
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <>
      <div className="card overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-slate-800">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-slate-500 uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="border-b border-r border-slate-800/50 min-h-[120px]" />;
            const calDay = dayMap[day];
            const isLoading = loadingDay === day;

            return (
              <div
                key={day}
                className="border-b border-r border-slate-800/50 min-h-[120px] p-2 hover:bg-slate-800/30 transition-colors group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-400">{day}</span>
                  {calDay && !calDay.post && (
                    <button
                      onClick={() => generatePost(calDay.id, day)}
                      disabled={isLoading}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded bg-brand-600/20 text-brand-400 hover:bg-brand-600/40 transition-all"
                      title="Generate post"
                    >
                      {isLoading ? <LoadingSpinner size="sm" /> : <Zap size={12} />}
                    </button>
                  )}
                </div>

                {calDay ? (
                  <div
                    className="space-y-1.5 cursor-pointer"
                    onClick={() => calDay.post && setSelectedPost(calDay.post)}
                  >
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${CONTENT_TYPE_COLORS[calDay.contentType] || 'bg-slate-700 text-slate-400'}`}>
                      {calDay.contentType}
                    </span>
                    <p className="text-xs text-slate-300 leading-tight line-clamp-2">{calDay.topic}</p>
                    <p className="text-xs text-slate-500">{calDay.postingTime}</p>

                    {calDay.post ? (
                      <div className="space-y-1">
                        {calDay.post.imageUrl && (
                          <img
                            src={calDay.post.imageUrl}
                            alt=""
                            className="w-full aspect-square object-cover rounded-md"
                          />
                        )}
                        <StatusBadge status={calDay.post.status} />
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); generatePost(calDay.id, day); }}
                        disabled={isLoading}
                        className="w-full py-1 text-xs text-brand-400 bg-brand-900/20 hover:bg-brand-900/40 rounded transition-colors flex items-center justify-center gap-1"
                      >
                        {isLoading ? <LoadingSpinner size="sm" /> : <Zap size={10} />}
                        Generate
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-700 text-xs">No plan</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onUpdate={(updated) => {
            setSelectedPost(updated);
            onPostUpdate?.(updated.calendarDayId, updated);
          }}
        />
      )}
    </>
  );
}

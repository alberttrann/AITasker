import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useNotificationsStore } from '@/store/notifications.store';
import { Bell, CheckCircle2, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/Spinner';

export default function NotificationSystem() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notifications, hydrate, markRead, markAllRead, remove } = useNotificationsStore();

  const { data: dbNotifs, isLoading } = useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: () => apiClient.get('/notifications/me', { params: { limit: 100 } }).then(r => r.data),
  });

  useEffect(() => {
    if (dbNotifs) {
      hydrate(dbNotifs);
    }
  }, [dbNotifs, hydrate]);

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.put(`/notifications/${id}/read`),
    onSuccess: (_, id) => {
      markRead(id);
      queryClient.invalidateQueries({ queryKey: ['notifications', 'all'] });
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.put('/notifications/read-all'),
    onSuccess: () => {
      markAllRead();
      queryClient.invalidateQueries({ queryKey: ['notifications', 'all'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/notifications/${id}`),
    onSuccess: (_, id) => {
      remove(id);
      queryClient.invalidateQueries({ queryKey: ['notifications', 'all'] });
    }
  });

  const handleNotificationClick = (notif: any) => {
    if (!notif.read && !notif.isRead) {
      markAsReadMutation.mutate(notif.id);
    }
    if (notif.link) {
      let targetLink = notif.link;
      if (targetLink === '/expert/projects' || targetLink.includes('/expert/invitations')) {
        targetLink = '/expert/service/projects';
      } else if (targetLink.startsWith('/engagements')) {
        const basePath = window.location.pathname.split('/')[1];
        targetLink = `/${basePath}${targetLink}`;
      }
      navigate(targetLink);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">Updates about your projects, bids, and wallet.</p>
        </div>
        
        {notifications.some(n => !n.read) && (
          <button 
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <CheckCircle2 size={16} /> Mark all as read
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center bg-slate-50/50">
            <Bell size={48} className="text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-800 mb-2">No notifications</h3>
            <p className="text-slate-500 text-sm">When you receive updates, they will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notif) => (
              <div 
                key={notif.id}
                className={`p-4 sm:p-5 flex items-start gap-4 transition-colors group ${!notif.read ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}
              >
                {!notif.read && (
                  <div className="mt-2 w-2 h-2 rounded-full bg-blue-500 shrink-0 shadow-sm" />
                )}
                
                <div 
                  className={`flex-1 min-w-0 ${notif.link ? 'cursor-pointer' : ''}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 mb-1">
                    <h4 className={`text-sm ${!notif.read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                      {notif.title}
                    </h4>
                    <span className="text-xs font-medium text-slate-400 shrink-0">
                      {new Date(notif.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {notif.body}
                  </p>
                </div>

                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(notif.id);
                    }}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete notification"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
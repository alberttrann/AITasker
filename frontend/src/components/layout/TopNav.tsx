import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import { Bell, Mail, Wallet, Search, ChevronDown } from 'lucide-react';

export default function TopNav() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const activeRole = useAuthStore(s => s.activeRole);
  const clientSubtype = useAuthStore(s => s.clientSubtype);

  const [messageOpen, setMessageOpen] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);

  // Lấy danh sách conversations realtime
  const { data: threads } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiClient.get('/conversations').then(r => r.data),
    refetchInterval: 10_000,
  });

  // Đóng dropdown khi click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (messageRef.current && !messageRef.current.contains(event.target as Node)) {
        setMessageOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRolePrefix = () => {
    if (activeRole === 'CLIENT' && clientSubtype === 'TECH_TEAM') return 'tech-team';
    if (activeRole === 'CLIENT') return 'ceo';
    if (activeRole === 'EXPERT') return 'expert';
    return 'tech-team';
  };

  const safeThreads = threads || [];
  // Lọc bỏ rác không tin nhắn khỏi danh sách Dropdown để chuẩn nhất với thực tế
  const filteredThreads = safeThreads.filter((t: any) => !!t.lastMessage && !!t.lastMessage.content);
  const totalUnread = filteredThreads.reduce((sum: number, t: any) => sum + (t.unreadCount || 0), 0);
  const recentThreads = filteredThreads.slice(0, 5); 

  // Xử lý khi nhấn vào một cuộc hội thoại từ Dropdown
  const handleConversationClick = async (id: string) => {
    setMessageOpen(false);
    try {
      // Gọi API đọc tin nhắn và làm mới cache để đồng bộ unread dot [5]
      await apiClient.post(`/conversations/${id}/read`);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error("Failed to mark conversation as read:", err);
    }
    navigate(`/${getRolePrefix()}/inbox/${id}`);
  };

  // Xử lý nút Mark All Read hoạt động hoàn hảo [5]
  const handleMarkAllRead = async () => {
    try {
      await apiClient.post('/conversations/read-all');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white sticky top-0 z-40 select-none">
      <div className="max-w-[1440px] mx-auto h-full px-6 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-4">
          <Link to={`/${getRolePrefix()}`} className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span className="text-[#059669]">AI</span>Tasker
          </Link>
        </div>

        {/* Center: Search */}
        <div className="hidden md:flex items-center relative w-full max-w-md">
          <Search size={16} className="absolute left-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects, milestones, expert services, or shortcuts..."
            className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all text-slate-800"
          />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          {/* Wallet Balance */}
          <Link
            to={`/${getRolePrefix()}/wallet`}
            className="p-2.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <Wallet size={19} />
          </Link>

          {/* Notifications */}
          <button className="p-2.5 rounded-full hover:bg-slate-100 text-slate-700 relative transition-colors">
            <Bell size={19} />
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
          </button>

          {/* Dropdown Inbox giống Facebook */}
          <div className="relative" ref={messageRef}>
            <button
              onClick={() => setMessageOpen(!messageOpen)}
              className={cn(
                "p-2.5 rounded-full relative transition-colors border",
                messageOpen ? "bg-[#0F172A]/5 border-slate-300" : "hover:bg-slate-100 text-slate-700 border-transparent"
              )}
            >
              <Mail size={19} />
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </button>

            {messageOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-sm text-slate-800">Inbox ({totalUnread})</h3>
                  <button 
                    onClick={handleMarkAllRead} 
                    className="text-xs font-semibold text-[#059669] hover:underline"
                  >
                    Mark all read
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {recentThreads.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <Mail size={24} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-semibold">No messages yet</p>
                    </div>
                  ) : (
                    recentThreads.map((thread: any) => {
                      const otherPartyName = thread.otherParty?.fullName || 'Partner';
                      const hasUnread = thread.unreadCount > 0;
                      const snippet = thread.lastMessage?.content || 'No messages';

                      return (
                        <div
                          key={thread.id}
                          onClick={() => handleConversationClick(thread.id)}
                          className={cn(
                            "p-3 flex gap-3 hover:bg-slate-50 cursor-pointer transition-colors items-center select-none",
                            hasUnread && "bg-[#059669]/5"
                          )}
                        >
                          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {otherPartyName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-0.5">
                              <h4 className={cn("text-xs truncate", hasUnread ? "font-bold text-slate-900" : "font-semibold text-slate-700")}>
                                {otherPartyName}
                              </h4>
                              {thread.lastMessage?.timestamp && (
                                <span className="text-[10px] text-slate-400">
                                  {new Date(thread.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate mb-0.5">{thread.projectName}</p>
                            <p className={cn("text-xs truncate", hasUnread ? "text-slate-900 font-bold" : "text-slate-500")}>
                              {snippet}
                            </p>
                          </div>
                          {hasUnread && (
                            <span className="w-2 h-2 bg-[#059669] rounded-full shrink-0" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div 
                  onClick={() => { setMessageOpen(false); navigate(`/${getRolePrefix()}/inbox`); }}
                  className="p-3 text-center border-t border-slate-100 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors text-xs font-bold text-[#059669]"
                >
                  Open Inbox
                </div>
              </div>
            )}
          </div>

          <div className="h-9 w-px bg-slate-200" />
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-[#0F172A] text-white flex items-center justify-center font-bold font-headline text-sm">
              {user?.fullName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-800 leading-tight">{user?.fullName || 'User'}</span>
              <span className="text-[10px] font-bold text-[#059669] uppercase tracking-wider">{activeRole}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
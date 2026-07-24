import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useReducer,
  useMemo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useMessages,
  useProjectMessages,
  useSendMessage,
  useConversations,
  useReadConversation,
} from "@/hooks/use-messages";
import { useSocket } from "@/hooks/use-socket";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/store/auth.store";
import { useEngagement } from "@/hooks/use-engagements";
import { useEngagementStore } from "@store/engagement.store";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import ChatSidebar from "@/components/messaging/ChatSidebar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/Spinner";
import {
  Send,
  MessageSquare,
  ChevronDown,
  Check,
  Hash,
  FolderKanban,
  X,
} from "lucide-react";

interface Message {
  id: string;
  content: string;
  timestamp: string;
  senderId: string;
  engagementId?: string;
  projectId?: string;
  sender: {
    id: string;
    email: string;
    fullName: string;
    activeRole: string;
  };
}

export default function MessageThread({
  engagementId: propEngagementId,
  projectId: propProjectId,
  onSelectEngagement,
}: {
  engagementId?: string;
  projectId?: string;
  onSelectEngagement?: (id: string) => void;
}) {
  const socket = useSocket();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { engagementId: urlEngagementId } = useParams<{
    engagementId?: string;
  }>();
  const engagementId = propEngagementId || urlEngagementId;
  const projectId = propProjectId; // projectId only comes from props in InboxPage

  const setActiveEngagement = useEngagementStore((s) => s.setActiveEngagement);
  const clearUnread = useEngagementStore((s) => s.clearUnread);
  const unreadCounts = useEngagementStore((s) => s.unreadCounts);

  const { data: engagement, isLoading: isLoadingEngagement } =
    useEngagement(engagementId);
  const { data: engData, isLoading: engLoading } = useMessages(engagementId);
  const { data: projData, isLoading: projLoading } =
    useProjectMessages(projectId);
  const { data: conversationsResponse } = useConversations();
  const sendMessage = useSendMessage();
  const readConversation = useReadConversation();

  const activeRole = useAuthStore((s) => s.activeRole);
  const queryClient = useQueryClient();

  const [text, setText] = useState("");
  const [selectedUser, setSelectedUser] = useState<{
    fullName: string;
    email: string;
    activeRole: string;
  } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchedMessages = engagementId ? engData : projData;
  const isLoading = engagementId
    ? engLoading || isLoadingEngagement
    : projLoading;
  const scopeId = engagementId || projectId;

  type MessageAction =
    | { type: "MERGE_FETCHED"; messages: Message[] }
    | { type: "APPEND"; message: Message }
    | { type: "RESET" };

  function messageReducer(state: Message[], action: MessageAction): Message[] {
    switch (action.type) {
      case "MERGE_FETCHED": {
        const merged = [...action.messages];
        for (const existing of state) {
          if (!merged.find((m) => m.id === existing.id)) {
            merged.push(existing);
          }
        }
        merged.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        return merged;
      }
      case "APPEND": {
        if (state.find((m) => m.id === action.message.id)) return state;
        return [...state, action.message].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
      }
      case "RESET":
        return [];
      default:
        return state;
    }
  }

  const [localMessages, dispatch] = useReducer(messageReducer, []);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [localMessages, scrollToBottom]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isDropdownOpen]);

  // Reset messages when switching to a different conversation to prevent cross-chat leakage
  useEffect(() => {
    dispatch({ type: "RESET" });
  }, [scopeId]);

  // Mark conversation as read when opening a thread
  useEffect(() => {
    if (!engagementId) return;
    readConversation.mutate(engagementId);
  }, [engagementId]);

  useEffect(() => {
    if (!socket || !scopeId) return;

    const payload = engagementId ? { engagementId } : { projectId };
    socket.emit("joinRoom", payload);

    if (engagementId) {
      setActiveEngagement(engagementId);
      clearUnread(engagementId);
    }

    return () => {
      if (engagementId) {
        setActiveEngagement(null);
      }
    };
  }, [
    socket,
    scopeId,
    engagementId,
    projectId,
    setActiveEngagement,
    clearUnread,
  ]);

  useEffect(() => {
    if (!fetchedMessages) return;
    const fetched = Array.isArray(fetchedMessages)
      ? fetchedMessages
      : ((fetchedMessages as any)?.data ?? []);
    dispatch({ type: "MERGE_FETCHED", messages: fetched });
  }, [fetchedMessages]);

  useEffect(() => {
    if (!socket) return;

    const handler = (msg: Message) => {
      const belongsToThisThread = engagementId
        ? msg.engagementId === engagementId
        : msg.projectId === projectId;

      if (!belongsToThisThread) return;

      dispatch({ type: "APPEND", message: msg });

      if (engagementId && msg.senderId !== user?.id) {
        readConversation.mutate(engagementId);
      }
    };

    socket.on("newMessage", handler);
    return () => {
      socket.off("newMessage", handler);
    };
  }, [socket, engagementId, projectId, user, queryClient]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!scopeId) return;

    const payload: any = { content: trimmed };
    if (engagementId) {
      payload.engagement_id = engagementId;
    } else if (projectId) {
      payload.project_id = projectId;
    }

    sendMessage(payload);
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const msgDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    if (msgDate.getTime() === today.getTime()) {
      return timeStr;
    } else if (msgDate.getTime() === yesterday.getTime()) {
      return `Yesterday, ${timeStr}`;
    } else {
      const dateStr = date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
      });
      return `${dateStr}, ${timeStr}`;
    }
  };

  const isClient =
    user?.activeRole === "CLIENT" || user?.activeRole?.startsWith("CLIENT");
  const dashboardRoute = isClient ? "/ceo" : "/expert";
  // Handle cả 2 format: { data: [...] } hoặc array thẳng
  const allConversations = Array.isArray(conversationsResponse)
    ? conversationsResponse
    : (conversationsResponse?.data ?? []);
  const currentConv = allConversations.find((c: any) => c.id === engagementId);

  // Phân giải định danh đối tác một cách an toàn bằng UUID thay vì chuỗi string [5]
  const targetPartnerId = useMemo(() => {
    if (currentConv?.otherParty?.id) return currentConv.otherParty.id;
    if (currentConv?.partnerId) return currentConv.partnerId;
    if (engagement) {
      if (isClient)
        return engagement.expertId || (engagement as any).expert?.id;
      return engagement.clientId || (engagement as any).client?.id;
    }
    return null;
  }, [currentConv, engagement, isClient]);

  // Phân giải tên đối tác tĩnh cố định đầu trang [5]
  const peerName = useMemo(() => {
    if (currentConv?.otherParty?.fullName)
      return currentConv.otherParty.fullName;
    if (currentConv?.partnerName) return currentConv.partnerName;
    if (engagement) {
      if (isClient) {
        return (
          (engagement as any).expert?.fullName ||
          (engagement as any).otherParty?.fullName ||
          "Expert"
        );
      } else {
        return (
          (engagement as any).client?.fullName ||
          (engagement as any).otherParty?.fullName ||
          "Client"
        );
      }
    }
    return "Partner";
  }, [currentConv, engagement, isClient]);

  // Lọc luồng bằng UUID giúp khắc phục lỗi biến mất dropdown & hiển thị thiếu luồng [5]
  const [stablePartnerId, setStablePartnerId] = useState<string | null>(null);

  // Reset hoặc cập nhật stablePartnerId khi chuyển sang engagement khác
  // Phải phụ thuộc vào cả targetPartnerId VÀ engagementId để tránh lỗi stuck ở null khi chuyển thread của cùng 1 partner
  useEffect(() => {
    setStablePartnerId(targetPartnerId || null);
  }, [targetPartnerId, engagementId]);

  const partnerEngagements = useMemo(() => {
  const pid = stablePartnerId;
  
  let result: any[];
  if (!pid) {
    result = allConversations.filter((c: any) => c.id === engagementId);
  } else {
    result = allConversations.filter((c: any) => {
      const cPartnerId = c.otherParty?.id || c.partnerId;
      return cPartnerId === pid;
    });
  }
  
  // Đảm bảo conversation hiện tại luôn có trong list (fallback safety)
  if (engagementId && !result.find((c: any) => c.id === engagementId)) {
    const currentEngConv = allConversations.find((c: any) => c.id === engagementId);
    if (currentEngConv) result = [currentEngConv, ...result];
  }
  
  return result;
}, [allConversations, stablePartnerId, engagementId]);

  const isNested = !!propEngagementId || !!propProjectId;

  // Ref cache để giữ peerName và targetPartnerId ổn định giữa các lần refetch
  const cachedPeerName = useRef<string>("");
  const cachedPartnerId = useRef<string | null>(null);

  // Chỉ cập nhật cache khi có giá trị thực sự
  useEffect(() => {
    if (
      peerName &&
      peerName !== "Partner" &&
      peerName !== "Expert" &&
      peerName !== "Client"
    ) {
      cachedPeerName.current = peerName;
    }
  }, [peerName]);

  useEffect(() => {
    if (targetPartnerId) {
      cachedPartnerId.current = targetPartnerId;
    }
  }, [targetPartnerId]);

  // Trợ lý nhãn vai trò hiển thị trên Message Bubble [5]
  const getRoleBadgeLabel = (role: string) => {
    if (!role) return "USER";
    const r = role.toUpperCase();
    if (r.includes("CEO") || r === "CLIENT") return "CEO";
    if (r.includes("EXPERT")) return "EXPERT";
    if (r.includes("TECH_TEAM") || r.includes("TECH_TEAM_PROFILE"))
      return "TECH TEAM";
    return r;
  };

  const getRoleBadgeStyle = (role: string) => {
    const cleanRole = getRoleBadgeLabel(role);
    if (cleanRole === "CEO")
      return "bg-blue-50 text-blue-700 border-blue-200/60";
    if (cleanRole === "EXPERT")
      return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
    if (cleanRole === "TECH TEAM")
      return "bg-purple-50 text-purple-700 border-purple-200/60";
    return "bg-slate-50 text-slate-600 border-slate-200";
  };

  const renderChatWindow = () => {
    if (!scopeId) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-[#F8FAFC]">
          <div className="w-16 h-16 bg-[#E2E8F0] rounded-full flex items-center justify-center mb-4 text-[#94A3B8]">
            <Send size={28} />
          </div>
          <h3 className="font-headline text-[16px] font-semibold text-[#64748B]">
            Select a conversation
          </h3>
          <p className="text-[13px] text-[#94A3B8] mt-1 max-w-xs">
            Choose a conversation from the left pane to start messaging.
          </p>
        </div>
      );
    }
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full bg-[#F8FAFC]">
          <Spinner size="lg" />
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white">
        {/* 1. Header Toolbar */}
        <div className="flex flex-row items-center justify-end py-4 border-b border-slate-200/80 shrink-0 gap-4">
          <div className="flex items-center gap-2 shrink-0"></div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Milestones Workspace Button */}
            {engagement &&
              ((engagement.milestones?.length || 0) > 0 || !!engagement.projectId) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (isClient) {
                      navigate(`/ceo/engagements/${engagementId}/milestones`);
                    } else {
                      const milestones = engagement.milestones || [];
                      const activeMilestone =
                        milestones.find(
                          (m: any) =>
                            m.state !== "RELEASED" && m.state !== "APPROVED",
                        ) || milestones[0];
                      if (activeMilestone) {
                        navigate(
                          `/expert/engagements/${engagementId}/milestones/${activeMilestone.id}`,
                        );
                      } else {
                        alert("No milestones defined yet.");
                      }
                    }
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 flex items-center gap-1.5 transition-all shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <FolderKanban size={14} className="text-slate-500" />
                  <span>Workspace</span>
                </Button>
              )}

            {/* Thread Dropdown — hiện khi có engagementId, dù partnerEngagements chưa load xong */}
            {engagementId && (
              <div
                className="relative flex items-center gap-2 shrink-0"
                ref={dropdownRef}
              >
                <span className="text-xs font-semibold text-slate-400 hidden sm:inline">
                  Thread:
                </span>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between gap-2 transition-all shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-900 max-w-[280px]"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Hash size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">
                      {partnerEngagements.find(
                        (e: any) => e.id === engagementId,
                      )?.projectName || "Direct Chat"}
                    </span>
                  </div>
                  {partnerEngagements.some(
                    (eng: any) =>
                      eng.id !== engagementId &&
                      (unreadCounts[eng.id] ?? eng.unreadCount ?? 0) > 0,
                  ) && (
                    <span
                      className="relative flex h-2 w-2 shrink-0 ml-1"
                      title="New messages in another thread"
                    >
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    className={`text-slate-400 shrink-0 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-[280px] sm:w-[320px] bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 py-1.5 overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <span>Select Thread ({partnerEngagements.length})</span>
                    </div>
                    <div className="max-h-[260px] overflow-y-auto divide-y divide-slate-100/60">
                      {partnerEngagements.map((eng: any) => {
                        const isSelected = eng.id === engagementId;
                        const count =
                          unreadCounts[eng.id] ?? eng.unreadCount ?? 0;
                        const hasNew = !isSelected && count > 0;

                        return (
                          <button
                            key={eng.id}
                            type="button"
                            onClick={() => {
                              setIsDropdownOpen(false);
                              if (eng.id !== engagementId) {
                                if (onSelectEngagement) {
                                  onSelectEngagement(eng.id);
                                } else {
                                  navigate(
                                    `${dashboardRoute}/engagements/${eng.id}/messages`,
                                  );
                                }
                              }
                            }}
                            className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                              isSelected
                                ? "bg-primary/5 text-primary font-bold"
                                : hasNew
                                  ? "bg-red-50/40 hover:bg-red-50/70 text-slate-900 font-semibold"
                                  : "hover:bg-slate-50 text-slate-700 font-medium"
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <Hash
                                size={15}
                                className={`mt-0.5 shrink-0 ${isSelected ? "text-primary" : hasNew ? "text-red-500" : "text-slate-400"}`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs truncate">
                                  {eng.projectName || "Direct Chat"}
                                </p>
                                {eng.lastMessage?.content && (
                                  <p
                                    className={`text-[11px] truncate mt-0.5 ${isSelected ? "text-primary/70" : hasNew ? "text-slate-700 font-medium" : "text-slate-400"}`}
                                  >
                                    {eng.lastMessage.content}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                              {hasNew && count > 0 && (
                                <span
                                  className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] text-center shrink-0"
                                  title={`${count} new messages`}
                                >
                                  {count}
                                </span>
                              )}
                              {isSelected && (
                                <Check
                                  size={16}
                                  className="text-primary shrink-0"
                                />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2. Message Thread Body */}
        <div className="flex-grow overflow-y-auto py-4 pl-4 pr-2 space-y-5 bg-transparent">
          {localMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-3">
              <MessageSquare size={36} className="text-slate-300" />
              <h3 className="text-sm font-bold text-slate-800">
                No Messages Yet
              </h3>
              <p className="text-xs text-slate-400 max-w-[280px]">
                Start the discussion! Type your questions, coordinate
                milestones, or align on scopes below.
              </p>
            </div>
          ) : (
            localMessages.map((msg: any) => {
              const isMe =
                msg.senderId === user?.id || msg.sender?.id === user?.id;
              const senderName = msg.sender?.fullName || "User";
              const senderInitial = senderName.charAt(0).toUpperCase();
              let senderRole = msg.sender?.activeRole || "";
              if (senderRole === "CLIENT" && engagement && (msg.senderId || msg.sender?.id) !== engagement.clientId) {
                senderRole = "TECH_TEAM";
              }

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 max-w-[75%] w-fit ${isMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                >
                  {!isMe && (
                    <div className="shrink-0 flex flex-col items-center pt-[2px]">
                      <div
                        onClick={() =>
                          setSelectedUser({
                            fullName: senderName,
                            email: msg.sender?.email || "N/A",
                            activeRole: senderRole,
                          })
                        }
                        className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        {senderInitial}
                      </div>
                    </div>
                  )}

                  <div
                    className={`space-y-1 min-w-0 max-w-full ${isMe ? "flex flex-col items-end" : "flex flex-col items-start"}`}
                  >
                    {/* ── NEW: Header tên + role (chỉ hiện cho người khác) ── */}
                    {!isMe && (
                      <div className="flex items-center gap-1.5 mb-0.5 px-1">
                        <span className="text-xs font-bold text-slate-800">
                          {senderName}
                        </span>
                        {senderRole && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${getRoleBadgeStyle(senderRole)}`}
                          >
                            {getRoleBadgeLabel(senderRole)}
                          </span>
                        )}
                      </div>
                    )}

                    <div
                    className={`w-fit max-w-full p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      isMe
                        ? "bg-emerald-600 text-white rounded-br-none"
                        : "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/60"
                    }`}
                  >
                    <p className="break-words whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1.5 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {msg.timestamp ? formatTime(msg.timestamp) : ""}
                    </p>
                    {isMe && (
                       <span title="Sent"><Check size={12} className="text-emerald-500" /></span>
                    )}
                  </div>
                </div>
                </div>
              );
            })
          )}
          <div ref={scrollRef} />
        </div>

        {/* 3. Send Input Form */}
        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 pt-3 pl-4 border-t border-slate-200/80 shrink-0"
        > 
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${peerName}...`}
            className="flex-1 px-4 py-2.5 bg-white border border-slate-200/80 border-b-2 focus:border-b-emerald-500 rounded-xl text-sm focus:outline-none transition-all text-slate-800 shadow-sm"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!text.trim()}
            className="p-2.5 rounded-xl shrink-0 h-10 w-10 justify-center items-center shadow-sm"
            aria-label="Send message"
          >
            <Send size={16} />
          </Button>
        </form>

        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl border border-[#E2E8F0] relative animate-in zoom-in-95 duration-200">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="absolute top-4 right-4 p-1 rounded-full hover:bg-[#F1F5F9] text-[#64748B] transition-colors"
              >
                <X size={18} />
              </button>

              <div className="text-center text-slate-800">
                <div className="w-16 h-16 bg-[#0F172A]/10 text-[#0F172A] flex items-center justify-center rounded-full text-2xl font-bold mx-auto mb-4 font-headline">
                  {selectedUser.fullName.charAt(0)}
                </div>
                <h3 className="text-lg font-bold text-[#0F172A] font-headline">
                  {selectedUser.fullName}
                </h3>
                <span className="inline-block px-2.5 py-0.5 mt-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#059669]/10 text-[#059669]">
                  {selectedUser.activeRole}
                </span>

                <div className="mt-6 border-t border-[#F1F5F9] pt-4 text-left space-y-3">
                  <div>
                    <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider block font-headline">
                      Email Address
                    </span>
                    <span className="text-[14px] text-[#0F172A] font-body font-medium">
                      {selectedUser.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider block font-headline">
                      System Role
                    </span>
                    <span className="text-[14px] text-[#0F172A] font-body font-medium">
                      {selectedUser.activeRole}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isNested) {
    return renderChatWindow();
  }

  return (
    <div className="w-full max-w-[1440px] px-6 mx-auto py-6 flex h-[calc(100vh-140px)] min-h-[600px] bg-transparent border-0 gap-6 overflow-hidden">
      {/* Left panel: Conversations List */}
      <ChatSidebar activeEngagementId={engagementId} />

      {/* Right panel: Active chat window */}
      <div className="flex-1 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex flex-col min-w-0 h-full p-4 sm:p-6 overflow-hidden">
        {renderChatWindow()}
      </div>
    </div>
  );
}
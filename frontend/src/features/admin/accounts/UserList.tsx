import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminUsers, useSuspendUser, useReactivateUser } from "@/hooks/use-admin";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ConfirmModal } from "@/components/ui/Modal";
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Ban,
  CheckCircle2,
  Shield,
  Clock,
  UserCheck,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROWS_PER_PAGE = 15;

export default function UserList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<{
    id: string;
    email: string;
    action: "suspend" | "reactivate";
  } | null>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useAdminUsers(page, ROWS_PER_PAGE);
  const suspendUser = useSuspendUser();
  const reactivateUser = useReactivateUser();

  // Support both paginated and plain array responses
  const users: any[] = Array.isArray(data) ? data : data?.data ?? [];
  const total: number = data?.total ?? users.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));

  // Client-side search filter
  const filteredUsers = search
    ? users.filter(
        (u: any) =>
          (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
          (u.full_name || u.fullName || "")
            .toLowerCase()
            .includes(search.toLowerCase())
      )
    : users;

  const handleToggleStatus = () => {
    if (!confirmTarget) return;
    const { id, action } = confirmTarget;
    if (action === "suspend") {
      suspendUser.mutate(id);
    } else {
      reactivateUser.mutate(id);
    }
    setConfirmTarget(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6 max-w-[1440px] mx-auto animate-in fade-in duration-500">
        <ErrorBanner
          message="Failed to load users."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            User Management
          </h1>
          <p className="text-slate-500 mt-2">
            Manage platform users, review account status, and handle
            suspensions.
          </p>
        </div>
      </div>

      {/* Search + Pagination bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by email or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
          />
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-sm text-slate-500">
            {total} user{total !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            </button>
            <span className="text-sm text-slate-600 font-medium px-2 min-w-[60px] text-center">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {filteredUsers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="No users found"
          description={
            search
              ? "No users match your search. Try a different query."
              : "There are no registered users on the platform yet."
          }
          action={
            search ? (
              <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                Clear Search
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-6 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-6 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Roles
                  </th>
                  <th className="text-left px-6 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Active Role
                  </th>
                  <th className="text-left px-6 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="text-right px-6 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user: any) => {
                  const isActive = user.is_active !== false;
                  const fullName =
                    user.full_name || user.fullName || "—";
                  const roles = Array.isArray(user.roles)
                    ? user.roles.join(", ")
                    : user.roles || "—";
                  const activeRole =
                    user.active_role || user.activeRole || "—";
                  const createdAt = user.created_at || user.createdAt;

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-slate-700 truncate max-w-[200px]">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 text-slate-900 font-medium">
                        {fullName}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-500">{roles}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider",
                            activeRole === "CLIENT"
                              ? "bg-sky-100 text-sky-700"
                              : activeRole === "EXPERT"
                              ? "bg-emerald-100 text-emerald-700"
                              : activeRole === "ADMIN"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-slate-100 text-slate-600"
                          )}
                        >
                          {activeRole}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <UserCheck className="h-3 w-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                            <UserX className="h-3 w-3" />
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {createdAt
                            ? new Date(createdAt).toLocaleDateString()
                            : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isActive ? (
                          <button
                            onClick={() =>
                              setConfirmTarget({
                                id: user.id,
                                email: user.email,
                                action: "suspend",
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              setConfirmTarget({
                                id: user.id,
                                email: user.email,
                                action: "reactivate",
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      <ConfirmModal
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleToggleStatus}
        title={
          confirmTarget?.action === "suspend"
            ? "Suspend User"
            : "Reactivate User"
        }
        confirmText={
          confirmTarget?.action === "suspend" ? "Suspend" : "Reactivate"
        }
        isDestructive={confirmTarget?.action === "suspend"}
      >
        <p>
          {confirmTarget?.action === "suspend"
            ? `Are you sure you want to suspend ${confirmTarget?.email}? They will no longer be able to log in.`
            : `Are you sure you want to reactivate ${confirmTarget?.email}? They will regain full platform access.`}
        </p>
      </ConfirmModal>
    </div>
  );
}

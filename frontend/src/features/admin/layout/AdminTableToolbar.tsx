import React from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterTab {
  label: string;
  value: string;
}

export interface AdminTableToolbarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  
  tabs?: FilterTab[];
  activeTab?: string;
  onTabChange?: (val: string) => void;
  
  statusOptions?: FilterTab[];
  activeStatus?: string;
  onStatusChange?: (val: string) => void;
  statusLabel?: string;
  
  itemCount: number;
  itemLabel?: string;
  
  page: number;
  totalPages: number;
  onPageChange: (val: number | ((p: number) => number)) => void;
}

export function AdminTableToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  tabs,
  activeTab,
  onTabChange,
  statusOptions,
  activeStatus,
  onStatusChange,
  statusLabel = "Status:",
  itemCount,
  itemLabel = "items",
  page,
  totalPages,
  onPageChange,
}: AdminTableToolbarProps) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
      {/* Filter Tabs & Status */}
      {(tabs?.length || statusOptions?.length) ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Main Filter Tabs */}
          {tabs && tabs.length > 0 && onTabChange && (
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => onTabChange(tab.value)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer",
                    activeTab === tab.value
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Status Filter */}
          {statusOptions && statusOptions.length > 0 && onStatusChange && (
            <div className="flex items-center gap-2">
              {statusLabel && (
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {statusLabel}
                </span>
              )}
              {statusOptions.map((st) => (
                <button
                  key={st.value}
                  onClick={() => onStatusChange(st.value)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                    activeStatus === st.value
                      ? "bg-primary/10 text-primary font-bold"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {st.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Search & Pagination Row */}
      <div className={cn(
        "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3",
        (tabs?.length || statusOptions?.length) ? "pt-2 border-t border-slate-100" : ""
      )}>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
          />
        </div>
        
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-sm text-slate-500">
            {itemCount} {itemLabel}{itemCount !== 1 && !itemLabel.endsWith('s') ? "s" : ""}
          </span>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange((p: number) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            </button>
            <span className="text-sm text-slate-600 font-medium px-2 min-w-[60px] text-center">
              {page} / {totalPages > 0 ? totalPages : 1}
            </span>
            <button
              onClick={() => onPageChange((p: number) => Math.min(totalPages > 0 ? totalPages : 1, p + 1))}
              disabled={page >= totalPages || totalPages === 0}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

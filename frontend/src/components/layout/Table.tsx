import React, { useState } from 'react';
import { ArrowUpDown, ChevronUp, ChevronDown, Check } from 'lucide-react';

export interface SortOption {
  label: string;
  value: string;
}

export interface DataListProps {
  title?: string;
  sortOptions?: SortOption[];
  currentSort?: string;
  onSortChange?: (value: string) => void;
  children: React.ReactNode;
  emptyState?: React.ReactNode;
  isEmpty?: boolean;
}

export function DataList({
  title,
  sortOptions,
  currentSort,
  onSortChange,
  children,
  emptyState,
  isEmpty
}: DataListProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        {title && <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-1">{title}</h4>}
        
        {sortOptions && sortOptions.length > 0 && onSortChange && (
          <div className="relative ml-auto">
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowUpDown size={16} />
              Order by
            </button>
            {isOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-20">
                  {sortOptions.map((opt) => (
                    <button 
                      key={opt.value}
                      onClick={() => { onSortChange(opt.value); setIsOpen(false); }} 
                      className={`block w-full text-left px-4 py-2 text-sm ${currentSort === opt.value ? 'bg-slate-50 text-slate-900 font-semibold flex items-center justify-between' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {opt.label}
                      {currentSort === opt.value && <Check size={14} className="text-emerald-500" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      
      {isEmpty && emptyState ? (
        emptyState
      ) : (
        children
      )}
    </div>
  );
}

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnKey: string) => void;
  emptyState?: React.ReactNode;
  keyExtractor: (item: T) => string | number;
}

export function DataTable<T>({
  columns,
  data,
  sortColumn,
  sortDirection,
  onSort,
  emptyState,
  keyExtractor
}: DataTableProps<T>) {
  return (
    <div className="w-full">
      {data.length === 0 && emptyState ? (
        emptyState
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-500">
                {columns.map((col) => (
                  <th 
                    key={String(col.key)}
                    className={`px-6 py-4 font-semibold uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:bg-slate-100 transition-colors select-none group' : ''}`}
                    onClick={() => {
                      if (col.sortable && onSort) {
                        onSort(String(col.key));
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      {col.label}
                      {col.sortable && (
                        sortColumn === col.key ? (
                          sortDirection === 'asc' ? <ChevronUp size={14} className="text-slate-700" /> : <ChevronDown size={14} className="text-slate-700" />
                        ) : (
                          <ChevronUp size={14} className="opacity-0 group-hover:opacity-30" />
                        )
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.map((item) => (
                <tr key={keyExtractor(item)} className="hover:bg-slate-50 transition-colors">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-6 py-4 text-slate-900 font-medium">
                      {col.render ? col.render(item) : (item as any)[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

interface SpotlightSearchProps {
  user: any;
  isAuthenticated: boolean;
}

interface SearchResultItem {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  badge?: string;
  route: string;
}

export default function SpotlightSearch({ user, isAuthenticated }: SpotlightSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine active persona
  const activeRole = useMemo(() => {
    if (!isAuthenticated || !user) return 'GUEST';
    if (user.activeRole === 'ADMIN' || user.roles?.includes('ADMIN')) return 'ADMIN';
    if (user.activeRole === 'TECH_TEAM' || user.clientSubtype === 'TECH_TEAM') return 'TECH_TEAM';
    if (user.activeRole === 'EXPERT') return 'EXPERT';
    return 'CLIENT_CEO';
  }, [user, isAuthenticated]);

  // Dynamic placeholders
  const placeholderText = useMemo(() => {
    switch (activeRole) {
      case 'ADMIN':
        return 'Search platform users, projects, disputes, or shortcuts...';
      case 'TECH_TEAM':
        return 'Search assigned workspaces, reviews, or shortcuts...';
      case 'EXPERT':
        return 'Search invitations, active engagements, services, or shortcuts...';
      case 'CLIENT_CEO':
      default:
        return 'Search projects, milestones, expert services, or shortcuts...';
    }
  }, [activeRole]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keyboard shortcut (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Fetch data safely and STRICTLY gated by activeRole so no 403 / 400 errors occur
  const { data: rawProjects } = useQuery({
    queryKey: ['projects', { slim: true }],
    queryFn: async () => {
      const res = await apiClient.get('/projects?slim=true');
      return res.data;
    },
    enabled: isAuthenticated && activeRole === 'CLIENT_CEO',
  });
  const projects = useMemo(() => Array.isArray(rawProjects) ? rawProjects : (rawProjects as any)?.data || [], [rawProjects]);

  const { data: rawServices } = useQuery({
    queryKey: ['services', { limit: 30 }],
    queryFn: async () => {
      const res = await apiClient.get('/services', { params: { limit: 30 } });
      return res.data;
    },
    enabled: isAuthenticated && (activeRole === 'CLIENT_CEO' || activeRole === 'EXPERT'),
  });
  const services = useMemo(() => Array.isArray(rawServices) ? rawServices : (rawServices as any)?.data || [], [rawServices]);

  const { data: rawEngagements } = useQuery({
    queryKey: ['engagements'],
    queryFn: async () => {
      const res = await apiClient.get('/engagements');
      return res.data;
    },
    enabled: isAuthenticated && activeRole === 'EXPERT',
  });
  const engagements = useMemo(() => Array.isArray(rawEngagements) ? rawEngagements : (rawEngagements as any)?.data || [], [rawEngagements]);

  const { data: rawInvitations } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const res = await apiClient.get('/invitations');
      return res.data;
    },
    enabled: isAuthenticated && activeRole === 'EXPERT',
  });
  const invitations = useMemo(() => Array.isArray(rawInvitations) ? rawInvitations : (rawInvitations as any)?.data || [], [rawInvitations]);

  const { data: rawTechEngagements } = useQuery({
    queryKey: ['engagements', 'tech-team'],
    queryFn: async () => {
      const res = await apiClient.get('/engagements/tech-team');
      return res.data;
    },
    enabled: isAuthenticated && activeRole === 'TECH_TEAM',
  });
  const techEngagements = useMemo(() => Array.isArray(rawTechEngagements) ? rawTechEngagements : (rawTechEngagements as any)?.data || [], [rawTechEngagements]);

  const { data: adminUsersData } = useQuery({
    queryKey: ['admin', 'users', 1, 30],
    queryFn: async () => {
      const res = await apiClient.get('/admin/users', { params: { page: 1, limit: 30 } });
      return res.data;
    },
    enabled: isAuthenticated && activeRole === 'ADMIN',
  });
  const adminUsers = useMemo(() => Array.isArray(adminUsersData) ? adminUsersData : (adminUsersData as any)?.data || [], [adminUsersData]);

  const { data: rawAdminDisputes } = useQuery({
    queryKey: ['admin', 'disputes', undefined],
    queryFn: async () => {
      const res = await apiClient.get('/admin/disputes');
      return res.data;
    },
    enabled: isAuthenticated && activeRole === 'ADMIN',
  });
  const adminDisputes = useMemo(() => Array.isArray(rawAdminDisputes) ? rawAdminDisputes : (rawAdminDisputes as any)?.data || [], [rawAdminDisputes]);

  // Compute matched results
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matched: SearchResultItem[] = [];

    // 2. Role-specific records
    if (activeRole === 'CLIENT_CEO') {
      // CEO Projects
      projects.forEach((p: any) => {
        const name = p.projectName || p.name || '';
        if (name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)) {
          matched.push({
            id: `proj-${p.id}`,
            category: 'Projects',
            title: name,
            subtitle: `Status: ${(p.state || 'DRAFT').replace(/_/g, ' ')}`,
            badge: p.tier || 'Project',
            route: `/ceo/projects/${p.id}`,
          });
        }
      });

      // Services
      services.forEach((s: any) => {
        const title = s.title || '';
        if (title.toLowerCase().includes(q)) {
          matched.push({
            id: `srv-${s.id}`,
            category: 'Expert Services',
            title: title,
            subtitle: s.expert?.fullName ? `By ${s.expert.fullName}` : 'Pre-packaged Service',
            badge: s.priceVnd ? `${Number(s.priceVnd).toLocaleString('vi-VN')} ₫` : 'Service',
            route: `/ceo/services/${s.id}`,
          });
        }
      });
    } else if (activeRole === 'EXPERT') {
      // Invitations
      invitations.forEach((inv: any) => {
        const pName = inv.project?.projectName || 'Project Invitation';
        const clientName = inv.ceo?.fullName || '';
        if (pName.toLowerCase().includes(q) || clientName.toLowerCase().includes(q)) {
          matched.push({
            id: `inv-${inv.id}`,
            category: 'Invitations',
            title: pName,
            subtitle: clientName ? `Invited by ${clientName}` : 'Incoming invitation',
            badge: inv.status || 'PENDING',
            route: '/expert/projects',
          });
        }
      });

      // Active Engagements
      engagements.forEach((eng: any) => {
        const pName = eng.project?.projectName || eng.projectName || 'Engagement';
        if (pName.toLowerCase().includes(q)) {
          matched.push({
            id: `eng-${eng.id}`,
            category: 'Active Workspaces',
            title: pName,
            subtitle: `Status: ${(eng.state || '').replace(/_/g, ' ')}`,
            route: `/engagements/${eng.id}/messages`,
          });
        }
      });

      // Expert Services
      services.forEach((s: any) => {
        const title = s.title || '';
        if (title.toLowerCase().includes(q)) {
          matched.push({
            id: `srv-${s.id}`,
            category: 'Services',
            title: title,
            subtitle: 'Service package',
            route: `/expert/services/${s.id}`,
          });
        }
      });
    } else if (activeRole === 'TECH_TEAM') {
      // Assigned Workspaces
      techEngagements.forEach((eng: any) => {
        const pName = eng.project?.projectName || eng.projectName || 'Assigned Project';
        if (pName.toLowerCase().includes(q)) {
          matched.push({
            id: `teng-${eng.id}`,
            category: 'Assigned Workspaces',
            title: pName,
            subtitle: `State: ${(eng.state || '').replace(/_/g, ' ')}`,
            route: `/engagements/${eng.id}/messages`,
          });
        }
      });
    } else if (activeRole === 'ADMIN') {
      // Users
      adminUsers.forEach((u: any) => {
        const name = u.fullName || u.name || '';
        const email = u.email || '';
        if (name.toLowerCase().includes(q) || email.toLowerCase().includes(q)) {
          matched.push({
            id: `usr-${u.id}`,
            category: 'Platform Users',
            title: name || email,
            subtitle: email,
            badge: (u.roles || []).join(', ') || 'USER',
            route: '/admin/users',
          });
        }
      });

      // Disputes
      adminDisputes.forEach((d: any) => {
        const reason = d.reason || d.additional_context || `Dispute #${d.id.slice(0, 8)}`;
        if (reason.toLowerCase().includes(q) || d.id.toLowerCase().includes(q)) {
          matched.push({
            id: `dsp-${d.id}`,
            category: 'Disputes',
            title: reason,
            subtitle: `Status: ${d.state || 'OPEN'}`,
            route: '/admin/disputes',
          });
        }
      });
    }

    return matched.slice(0, 8); // top 8 matches
  }, [query, activeRole, projects, services, invitations, engagements, techEngagements, adminUsers, adminDisputes]);

  // Group results by category
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResultItem[]> = {};
    results.forEach((item) => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [results]);

  const handleSelect = (route: string) => {
    setIsOpen(false);
    setQuery('');
    navigate(route);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results.length > 0) {
      handleSelect(results[0].route);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="w-full flex items-stretch group border-[1.5px] border-primary-dark/30 rounded overflow-hidden transition-colors duration-150 hover:border-primary-dark/50 focus-within:border-primary-dark min-w-0 bg-white">
        <input 
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length >= 1) setIsOpen(true);
            else setIsOpen(false);
          }}
          onFocus={() => {
            if (query.trim().length >= 1) setIsOpen(true);
          }}
          placeholder={placeholderText}
          className="flex-1 min-w-0 w-full bg-transparent pl-4 pr-8 py-2.5 text-sm font-medium text-primary-dark placeholder:text-primary-dark/50 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            <X size={14} />
          </button>
        )}
        <button 
          type="submit"
          aria-label="Search"
          className="flex items-center justify-center shrink-0 w-11 bg-primary-dark text-white hover:bg-primary-dark/90 transition-colors duration-150 cursor-pointer"
        >
          <Search size={18} strokeWidth={1.8} />
        </button>
      </form>

      {/* Spotlight Dropdown Overlay */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/80 max-h-[420px] overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
          {Object.keys(groupedResults).length > 0 ? (
            Object.entries(groupedResults).map(([category, items]) => (
              <div key={category} className="p-2">
                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {category}
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.route)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100/80 transition-colors text-left group cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {item.title}
                          </p>
                          {item.subtitle && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {item.subtitle}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.badge && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold tracking-wide border border-slate-200">
                              {item.badge}
                            </span>
                          )}
                          <ArrowRight size={14} className="text-slate-300 group-hover:text-emerald-600 transition-colors" />
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 px-4 text-center">
              <Search size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No results found for "{query}"</p>
              <p className="text-xs text-slate-400 mt-1">Try searching by keyword, ID, or page shortcut</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  Shield,
  Users,
  Settings,
  ScrollText,
  Wallet,
  Wrench,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Overview",
    path: "/admin",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Analytics",
    path: "/admin/analytics",
    icon: BarChart3,
  },
  {
    label: "Disputes",
    path: "/admin/disputes",
    icon: Shield,
  },
  {
    label: "Users",
    path: "/admin/users",
    icon: Users,
  },
  {
    label: "Platform Settings",
    path: "/admin/settings",
    icon: Settings,
  },
  {
    label: "Ledger",
    path: "/admin/ledger",
    icon: ScrollText,
  },
  {
    label: "Withdrawals",
    path: "/admin/withdrawals",
    icon: Wallet,
  },
  {
    label: "Config",
    path: "/admin/config",
    icon: Wrench,
  },
];

export default function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close mobile sidebar on route change
  const handleNavClick = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen((p) => !p)}
        className="lg:hidden fixed top-3 left-3 z-[110] p-2 bg-white rounded-lg border border-slate-200 shadow-sm"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5 text-slate-600" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[105] bg-slate-900/30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-[106] h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-200 shrink-0",
          collapsed ? "w-[68px]" : "w-[240px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo / Brand */}
        <div
          className={cn(
            "flex items-center h-16 px-4 border-b border-slate-100",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          {!collapsed && (
            <span className="font-headline font-bold text-lg text-slate-900 tracking-tight">
              Admin
            </span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:flex items-center justify-center h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform",
                collapsed && "rotate-180"
              )}
            />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.end
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  collapsed && "justify-center px-2"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">AITasker Admin v1.0</p>
          </div>
        )}
      </aside>
    </>
  );
}

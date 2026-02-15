import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Shield,
  Activity,
  HeadphonesIcon,
  BarChart3,
  Settings,
  FileText,
  Server,
  LogOut,
  Bell,
  Search,
  BarChart2,
  Mail,
  ShieldCheck,
  LineChart,
  Plug,
  Brain,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Tenants', href: '/tenants', icon: Building2 },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Roles & Permissions', href: '/roles', icon: Shield },
  { name: 'Platform', href: '/platform', icon: BarChart2 },
  { name: 'Communications', href: '/communications', icon: Mail },
  { name: 'Compliance', href: '/compliance', icon: ShieldCheck },
  { name: 'Analytics', href: '/analytics', icon: LineChart },
  { name: 'Integrations', href: '/integrations', icon: Plug },
  { name: 'Operations', href: '/operations', icon: Activity },
  { name: 'Support', href: '/support', icon: HeadphonesIcon },
  { name: 'AI Cockpit', href: '/ai', icon: Brain },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Configuration', href: '/configuration', icon: Settings },
  { name: 'Audit Log', href: '/audit', icon: FileText },
  { name: 'System Health', href: '/system', icon: Server },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const getPageTitle = () => {
    const current = navigation.find((item) => item.href === location.pathname);
    if (current) return current.name;
    if (location.pathname.startsWith('/tenants/onboard')) return 'Tenant Onboarding';
    if (location.pathname.startsWith('/roles/permissions')) return 'Permission Matrix';
    if (location.pathname.startsWith('/roles/approvals')) return 'Approval Matrix';
    if (location.pathname.startsWith('/operations/control-tower')) return 'Control Tower';
    if (location.pathname.startsWith('/support/timeline')) return 'Customer Timeline';
    if (location.pathname.startsWith('/support/escalation')) return 'Case Escalation';
    if (location.pathname.startsWith('/platform')) return 'Platform';
    if (location.pathname.startsWith('/communications')) return 'Communications';
    if (location.pathname.startsWith('/compliance')) return 'Compliance';
    if (location.pathname.startsWith('/analytics')) return 'Analytics';
    if (location.pathname.startsWith('/integrations')) return 'Integrations';
    return 'Admin Portal';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-600 rounded-lg flex items-center justify-center">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg">BOSSNYUMBA</h1>
              <p className="text-xs text-slate-400">Internal Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) => {
                const isSectionActive = item.href !== '/' && (location.pathname === item.href || location.pathname.startsWith(item.href + '/'));
                return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive || isSectionActive
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`;
              }}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-violet-500 rounded-full flex items-center justify-center text-sm font-medium">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-slate-400 truncate">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-64">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {getPageTitle()}
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 w-64"
                />
              </div>

              <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

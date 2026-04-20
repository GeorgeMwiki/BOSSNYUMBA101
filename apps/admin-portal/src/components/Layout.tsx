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
  Search,
  BarChart2,
  Mail,
  ShieldCheck,
  LineChart,
  Plug,
  Brain,
  Boxes,
  Wrench,
  Radio,
  Workflow,
  Coins,
  Lock,
  Flag,
  KeyRound,
  UploadCloud,
  GraduationCap,
  TrendingUp,
  Inbox,
  ShieldCheck as ShieldCheckIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '../contexts/AuthContext';
import { LocaleSwitcher } from './LocaleSwitcher';
import { NotificationBell } from './NotificationBell';
import { ShortcutCheatSheet } from './ShortcutCheatSheet';

interface NavItem {
  readonly name: string;
  readonly href: string;
  readonly icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  readonly heading: string;
  readonly items: readonly NavItem[];
}

const NAV_GROUPS: readonly NavGroup[] = [
  {
    heading: 'Overview',
    items: [{ name: 'Dashboard', href: '/', icon: LayoutDashboard }],
  },
  {
    heading: 'Operations',
    items: [
      { name: 'Tenants', href: '/tenants', icon: Building2 },
      { name: 'Operations', href: '/operations', icon: Activity },
      { name: 'Support', href: '/support', icon: HeadphonesIcon },
      { name: 'Maintenance Taxonomy', href: '/maintenance-taxonomy', icon: Wrench },
      { name: 'Warehouse', href: '/warehouse', icon: Boxes },
      { name: 'IoT Sensors', href: '/iot', icon: Radio },
      { name: 'Workflows', href: '/workflows', icon: Workflow },
    ],
  },
  {
    heading: 'Finance',
    items: [
      { name: 'Reports', href: '/reports', icon: BarChart3 },
      { name: 'AI Costs', href: '/ai-costs', icon: Coins },
    ],
  },
  {
    heading: 'AI Brain',
    items: [
      { name: 'AI Cockpit', href: '/ai', icon: Brain },
      { name: 'Classroom', href: '/classroom', icon: GraduationCap },
      { name: 'Exceptions', href: '/exceptions', icon: Inbox },
    ],
  },
  {
    heading: 'Org Insights',
    items: [
      { name: 'Org Insights', href: '/org-insights', icon: TrendingUp },
      { name: 'Platform', href: '/platform', icon: BarChart2 },
      { name: 'Analytics', href: '/analytics', icon: LineChart },
      { name: 'Communications', href: '/communications', icon: Mail },
      { name: 'Compliance', href: '/compliance', icon: ShieldCheck },
    ],
  },
  {
    heading: 'Settings',
    items: [
      { name: 'Users', href: '/users', icon: Users },
      { name: 'Roles & Permissions', href: '/roles', icon: Shield },
      { name: 'Integrations', href: '/integrations', icon: Plug },
      { name: 'API Integrations', href: '/api-integrations', icon: KeyRound },
      { name: 'Configuration', href: '/configuration', icon: Settings },
      { name: 'Feature Flags', href: '/feature-flags', icon: Flag },
      { name: 'Compliance Settings', href: '/compliance-settings', icon: ShieldCheckIcon },
      { name: 'Data Privacy', href: '/data-privacy', icon: Lock },
      { name: 'Audit Log', href: '/audit', icon: FileText },
      { name: 'System Health', href: '/system', icon: Server },
      { name: 'Webhook DLQ', href: '/webhook-dlq', icon: Inbox },
      { name: 'Legacy Migration', href: '/legacy-migration', icon: UploadCloud },
    ],
  },
];

const FLAT_NAV: readonly NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const tActions = useTranslations('actions');
  const tApp = useTranslations('app');

  const getPageTitle = () => {
    const current = FLAT_NAV.find((item) => item.href === location.pathname);
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
              <h1 className="font-bold text-lg">{tApp('title')}</h1>
              <p className="text-xs text-slate-400">Internal Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.heading} className="mb-4">
              <h2 className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {group.heading}
              </h2>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    end={item.href === '/'}
                    className={({ isActive }) => {
                      const isSectionActive =
                        item.href !== '/' &&
                        (location.pathname === item.href ||
                          location.pathname.startsWith(item.href + '/'));
                      return `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
              </div>
            </div>
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
            {tActions('signOut')}
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
              <LocaleSwitcher />
              <button
                type="button"
                aria-label="Open search (Cmd+K)"
                onClick={() => {
                  const isMac = navigator.platform.toUpperCase().includes('MAC');
                  const event = new KeyboardEvent('keydown', {
                    key: 'k',
                    code: 'KeyK',
                    metaKey: isMac,
                    ctrlKey: !isMac,
                    bubbles: true,
                  });
                  document.dispatchEvent(event);
                }}
                className="flex items-center gap-2 pl-3 pr-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500 w-64 text-left"
              >
                <Search aria-hidden="true" className="h-4 w-4 text-gray-400" />
                <span className="flex-1">Search anywhere</span>
                <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 border border-gray-200 rounded">
                  {navigator.platform.toUpperCase().includes('MAC') ? 'Cmd K' : 'Ctrl K'}
                </kbd>
              </button>

              <NotificationBell />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
      <ShortcutCheatSheet />
    </div>
  );
}

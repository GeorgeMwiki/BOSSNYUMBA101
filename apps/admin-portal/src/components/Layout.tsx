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

function buildNavGroups(tNav: (k: string) => string, tGroup: (k: string) => string): readonly NavGroup[] {
  return [
    {
      heading: tGroup('overview'),
      items: [{ name: tNav('dashboard'), href: '/', icon: LayoutDashboard }],
    },
    {
      heading: tGroup('operations'),
      items: [
        { name: tNav('tenants'), href: '/tenants', icon: Building2 },
        { name: tNav('operations'), href: '/operations', icon: Activity },
        { name: tNav('support'), href: '/support', icon: HeadphonesIcon },
        { name: tNav('maintenanceTaxonomy'), href: '/maintenance-taxonomy', icon: Wrench },
        { name: tNav('warehouse'), href: '/warehouse', icon: Boxes },
        { name: tNav('iot'), href: '/iot', icon: Radio },
        { name: tNav('workflows'), href: '/workflows', icon: Workflow },
      ],
    },
    {
      heading: tGroup('finance'),
      items: [
        { name: tNav('reports'), href: '/reports', icon: BarChart3 },
        { name: tNav('aiCosts'), href: '/ai-costs', icon: Coins },
      ],
    },
    {
      heading: tGroup('aiBrain'),
      items: [
        { name: tGroup('aiCockpit'), href: '/ai', icon: Brain },
        { name: tNav('classroom'), href: '/classroom', icon: GraduationCap },
        { name: tGroup('exceptions'), href: '/exceptions', icon: Inbox },
      ],
    },
    {
      heading: tGroup('orgInsights'),
      items: [
        { name: tNav('orgInsights'), href: '/org-insights', icon: TrendingUp },
        { name: tNav('platform'), href: '/platform', icon: BarChart2 },
        { name: tNav('analytics'), href: '/analytics', icon: LineChart },
        { name: tNav('communications'), href: '/communications', icon: Mail },
        { name: tNav('compliance'), href: '/compliance', icon: ShieldCheck },
      ],
    },
    {
      heading: tGroup('settings'),
      items: [
        { name: tNav('users'), href: '/users', icon: Users },
        { name: tGroup('rolesAndPermissions'), href: '/roles', icon: Shield },
        { name: tNav('integrations'), href: '/integrations', icon: Plug },
        { name: tNav('apiIntegrations'), href: '/api-integrations', icon: KeyRound },
        { name: tNav('configuration'), href: '/configuration', icon: Settings },
        { name: tNav('featureFlags'), href: '/feature-flags', icon: Flag },
        { name: tNav('complianceSettings'), href: '/compliance-settings', icon: ShieldCheckIcon },
        { name: tNav('dataPrivacy'), href: '/data-privacy', icon: Lock },
        { name: tGroup('auditLog'), href: '/audit', icon: FileText },
        { name: tGroup('systemHealth'), href: '/system', icon: Server },
        { name: tNav('webhookDlq'), href: '/webhook-dlq', icon: Inbox },
        { name: tNav('legacyMigration'), href: '/legacy-migration', icon: UploadCloud },
      ],
    },
  ];
}

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const tActions = useTranslations('actions');
  const tApp = useTranslations('app');
  const tLayout = useTranslations('layout');
  const tNav = useTranslations('nav');
  const tNavGroup = useTranslations('layout.nav');
  const tA11y = useTranslations('a11y');
  const NAV_GROUPS = buildNavGroups(tNav, tNavGroup);
  const FLAT_NAV = NAV_GROUPS.flatMap((g) => g.items);

  const getPageTitle = () => {
    const current = FLAT_NAV.find((item) => item.href === location.pathname);
    if (current) return current.name;
    if (location.pathname.startsWith('/tenants/onboard')) return tLayout('pageTitles.tenantOnboarding');
    if (location.pathname.startsWith('/roles/permissions')) return tLayout('pageTitles.permissionMatrix');
    if (location.pathname.startsWith('/roles/approvals')) return tLayout('pageTitles.approvalMatrix');
    if (location.pathname.startsWith('/operations/control-tower')) return tLayout('pageTitles.controlTower');
    if (location.pathname.startsWith('/support/timeline')) return tLayout('pageTitles.customerTimeline');
    if (location.pathname.startsWith('/support/escalation')) return tLayout('pageTitles.caseEscalation');
    if (location.pathname.startsWith('/platform')) return tLayout('pageTitles.platform');
    if (location.pathname.startsWith('/communications')) return tLayout('pageTitles.communications');
    if (location.pathname.startsWith('/compliance')) return tLayout('pageTitles.compliance');
    if (location.pathname.startsWith('/analytics')) return tLayout('pageTitles.analytics');
    if (location.pathname.startsWith('/integrations')) return tLayout('pageTitles.integrations');
    return tLayout('pageTitles.default');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <a href="#main-content" className="skip-link">
        {tA11y('skipToMain')}
      </a>
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-600 rounded-lg flex items-center justify-center">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg">{tApp('title')}</h1>
              <p className="text-xs text-slate-400">{tLayout('internalAdmin')}</p>
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
                aria-label={tLayout('searchAria')}
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
                <span className="flex-1">{tLayout('searchAnywhere')}</span>
                <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 border border-gray-200 rounded">
                  {navigator.platform.toUpperCase().includes('MAC') ? 'Cmd K' : 'Ctrl K'}
                </kbd>
              </button>

              <NotificationBell />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="p-6" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <ShortcutCheatSheet />
    </div>
  );
}

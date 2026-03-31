import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  DollarSign,
  Wrench,
  FileText,
  CheckSquare,
  BarChart3,
  MessageSquare,
  Settings,
  LogOut,
  Bell,
  Menu,
  X,
  Home,
  PieChart,
  LineChart,
  Users,
  Shield,
  Wallet,
  Briefcase,
  Activity,
  HeadphonesIcon,
  Mail,
  Brain,
  Plug,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react';
import { useAuth, canAccessModule } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  module?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navigationSections: NavSection[] = [
  {
    label: 'OVERVIEW',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
      { name: 'Portfolio', href: '/portfolio', icon: PieChart, module: 'portfolio' },
      { name: 'Properties', href: '/properties', icon: Building2, module: 'properties' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { name: 'Maintenance', href: '/maintenance', icon: Wrench, module: 'maintenance' },
      { name: 'Work Orders', href: '/operations', icon: Activity, module: 'operations' },
      { name: 'Approvals', href: '/approvals', icon: CheckSquare, module: 'approvals' },
    ],
  },
  {
    label: 'PEOPLE',
    items: [
      { name: 'Tenants', href: '/tenants', icon: Users, module: 'tenants' },
      { name: 'Vendors', href: '/vendors', icon: Briefcase, module: 'vendors' },
      { name: 'Users & Staff', href: '/users', icon: Shield, module: 'users' },
      { name: 'Roles & Permissions', href: '/roles', icon: ClipboardList, module: 'roles' },
    ],
  },
  {
    label: 'FINANCE',
    items: [
      { name: 'Financial', href: '/financial', icon: DollarSign, module: 'financial' },
      { name: 'Budgets', href: '/budgets', icon: Wallet, module: 'budgets' },
    ],
  },
  {
    label: 'COMMUNICATIONS',
    items: [
      { name: 'Messages', href: '/messages', icon: MessageSquare, module: 'messages' },
      { name: 'Communications Hub', href: '/communications', icon: Mail, module: 'communications' },
    ],
  },
  {
    label: 'ANALYTICS & REPORTS',
    items: [
      { name: 'Analytics', href: '/analytics', icon: LineChart, module: 'analytics' },
      { name: 'Reports', href: '/reports', icon: BarChart3, module: 'reports' },
      { name: 'AI Cockpit', href: '/ai', icon: Brain, module: 'ai' },
    ],
  },
  {
    label: 'COMPLIANCE',
    items: [
      { name: 'Compliance', href: '/compliance', icon: ShieldCheck, module: 'compliance' },
      { name: 'Documents', href: '/documents', icon: FileText, module: 'documents' },
    ],
  },
  {
    label: 'ADMINISTRATION',
    items: [
      { name: 'Configuration', href: '/configuration', icon: Settings, module: 'configuration' },
      { name: 'Integrations', href: '/integrations', icon: Plug, module: 'integrations' },
      { name: 'Audit Log', href: '/audit', icon: ClipboardList, module: 'audit' },
      { name: 'Support', href: '/support', icon: HeadphonesIcon, module: 'support' },
    ],
  },
];

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, tenant, role, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter navigation sections based on role
  const filteredSections = navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        !item.module || canAccessModule(role, item.module)
      ),
    }))
    .filter((section) => section.items.length > 0);

  const renderNavItems = (items: NavItem[], closeSidebar?: boolean) =>
    items.map((item) => {
      const isActive = location.pathname === item.href ||
        (item.href !== '/dashboard' && location.pathname.startsWith(item.href + '/'));
      return (
        <Link
          key={item.name}
          to={item.href}
          onClick={closeSidebar ? () => setSidebarOpen(false) : undefined}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <item.icon className="h-5 w-5" />
          {item.name}
        </Link>
      );
    });

  const renderSections = (closeSidebar?: boolean) =>
    filteredSections.map((section) => (
      <div key={section.label} className="mb-4">
        <p className="px-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {section.label}
        </p>
        <div className="space-y-0.5">
          {renderNavItems(section.items, closeSidebar)}
        </div>
      </div>
    ));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white transform transition-transform duration-200 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-4 border-b">
            <div className="flex items-center gap-2">
              <Home className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">BOSSNYUMBA</span>
            </div>
            <button onClick={() => setSidebarOpen(false)}>
              <X className="h-6 w-6 text-gray-500" />
            </button>
          </div>
          <nav className="flex-1 px-2 py-4 overflow-y-auto">
            {renderSections(true)}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex items-center gap-2 px-4 py-4 border-b">
            <Home className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">BOSSNYUMBA</h1>
              <p className="text-xs text-gray-500">Owner Portal</p>
            </div>
          </div>
          <nav className="flex-1 px-2 py-4 overflow-y-auto">
            {renderSections()}
          </nav>
          <div className="border-t border-gray-200 p-4">
            <Link
              to="/settings"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <Settings className="h-5 w-5" />
              Settings
            </Link>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden -m-2.5 p-2.5 text-gray-700"
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex-1" />

          <button onClick={() => navigate('/notifications')} className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <Bell className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
              3
            </span>
          </button>

          <div className="flex items-center gap-3 border-l pl-4">
            <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-700">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500">{tenant?.name}</p>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

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
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '../contexts/AuthContext';
import { LocaleSwitcher } from './LocaleSwitcher';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Portfolio', href: '/portfolio', icon: PieChart },
  { name: 'Properties', href: '/properties', icon: Building2 },
  { name: 'Analytics', href: '/analytics', icon: LineChart },
  { name: 'Tenants', href: '/tenants', icon: Users },
  { name: 'Vendors', href: '/vendors', icon: Briefcase },
  { name: 'Budgets', href: '/budgets', icon: Wallet },
  { name: 'Compliance', href: '/compliance', icon: Shield },
  { name: 'Financial', href: '/financial', icon: DollarSign },
  { name: 'Maintenance', href: '/maintenance', icon: Wrench },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Approvals', href: '/approvals', icon: CheckSquare },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Messages', href: '/messages', icon: MessageSquare },
];

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, tenant, logout } = useAuth();
  const tApp = useTranslations('app');
  const tActions = useTranslations('actions');
  const tNav = useTranslations('nav');
  const tA11y = useTranslations('a11y');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <a href="#main-content" className="skip-link">
        {tA11y('skipToMain')}
      </a>
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
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label={tApp('closeNav')}
              className="p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <X className="h-6 w-6 text-gray-500" aria-hidden="true" />
            </button>
          </div>
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
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
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex items-center gap-2 px-4 py-4 border-b">
            <Home className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{tApp('title')}</h1>
              <p className="text-xs text-gray-500">{tApp('subtitle')}</p>
            </div>
          </div>
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
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
            })}
          </nav>
          <div className="border-t border-gray-200 p-4">
            <Link
              to="/settings"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <Settings className="h-5 w-5" />
              {tNav('settings')}
            </Link>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
              {tActions('signOut')}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label={tApp('openNav')}
            className="lg:hidden -m-2.5 p-2.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>

          <div className="flex-1" />

          <LocaleSwitcher />

          <button
            type="button"
            aria-label={tApp('notifications')}
            className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white"
            >
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
        <main id="main-content" tabIndex={-1} className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

import * as React from 'react';
import { Bell, Search, Menu, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { Avatar } from './Avatar';
import { Dropdown, DropdownItem } from './Dropdown';

export interface HeaderProps {
  logo?: React.ReactNode;
  title?: string;
  user?: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  userMenuItems?: DropdownItem[];
  notifications?: number;
  onNotificationsClick?: () => void;
  onMenuClick?: () => void;
  showMobileMenu?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  actions?: React.ReactNode;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  logo,
  title,
  user,
  userMenuItems = [],
  notifications,
  onNotificationsClick,
  onMenuClick,
  showMobileMenu,
  searchPlaceholder = 'Search...',
  onSearch,
  actions,
  className,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 sm:px-6',
        className
      )}
    >
      {/* Mobile menu button */}
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="lg:hidden -m-2.5 p-2.5 text-gray-700"
        >
          {showMobileMenu ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      )}

      {/* Logo / Title */}
      <div className="flex items-center gap-3">
        {logo}
        {title && (
          <h1 className="text-lg font-semibold text-gray-900 hidden sm:block">
            {title}
          </h1>
        )}
      </div>

      {/* Search */}
      {onSearch && (
        <form
          onSubmit={handleSearchSubmit}
          className="hidden md:flex flex-1 max-w-md mx-4"
        >
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-9 rounded-lg border border-gray-300 bg-gray-50 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </form>
      )}

      {/* Right side */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Custom actions */}
        {actions}

        {/* Notifications */}
        {onNotificationsClick && (
          <button
            onClick={onNotificationsClick}
            className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <Bell className="h-5 w-5" />
            {notifications !== undefined && notifications > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
                {notifications > 99 ? '99+' : notifications}
              </span>
            )}
          </button>
        )}

        {/* User menu */}
        {user && (
          <Dropdown
            align="right"
            items={userMenuItems}
            trigger={
              <button className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-gray-100">
                <Avatar
                  src={user.avatarUrl}
                  fallback={user.name}
                  size="sm"
                />
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium text-gray-700">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </button>
            }
          />
        )}
      </div>
    </header>
  );
};

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}) => {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            {breadcrumbs.map((crumb, index) => (
              <li key={index} className="flex items-center">
                {index > 0 && (
                  <span className="mx-2 text-gray-400">/</span>
                )}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-sm text-gray-500">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
};

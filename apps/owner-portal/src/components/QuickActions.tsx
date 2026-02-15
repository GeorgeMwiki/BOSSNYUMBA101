import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  DollarSign,
  Wrench,
  MessageSquare,
  Download,
  CheckSquare,
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'view-statements',
    label: 'View Statements',
    description: 'Monthly financial reports',
    icon: <FileText className="h-5 w-5" />,
    href: '/financial?tab=statements',
    color: 'bg-blue-100 text-blue-600 hover:bg-blue-200',
  },
  {
    id: 'export-report',
    label: 'Export Report',
    description: 'Download PDF/Excel',
    icon: <Download className="h-5 w-5" />,
    href: '/reports?action=export',
    color: 'bg-green-100 text-green-600 hover:bg-green-200',
  },
  {
    id: 'review-approvals',
    label: 'Review Approvals',
    description: 'Pending work orders',
    icon: <CheckSquare className="h-5 w-5" />,
    href: '/approvals',
    color: 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200',
  },
  {
    id: 'message-manager',
    label: 'Message Manager',
    description: 'Contact estate manager',
    icon: <MessageSquare className="h-5 w-5" />,
    href: '/messages',
    color: 'bg-purple-100 text-purple-600 hover:bg-purple-200',
  },
  {
    id: 'view-maintenance',
    label: 'Maintenance Status',
    description: 'Track work orders',
    icon: <Wrench className="h-5 w-5" />,
    href: '/maintenance',
    color: 'bg-orange-100 text-orange-600 hover:bg-orange-200',
  },
  {
    id: 'view-disbursements',
    label: 'Disbursements',
    description: 'Payment history',
    icon: <DollarSign className="h-5 w-5" />,
    href: '/financial?tab=disbursements',
    color: 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200',
  },
];

interface QuickActionsProps {
  className?: string;
}

export function QuickActions({ className }: QuickActionsProps) {
  return (
    <div className={className}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {quickActions.map((action) => (
          <Link
            key={action.id}
            to={action.href}
            className="group flex flex-col items-center p-4 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-all"
          >
            <div className={`p-3 rounded-full ${action.color} transition-colors`}>
              {action.icon}
            </div>
            <p className="mt-2 text-sm font-medium text-gray-900 text-center">
              {action.label}
            </p>
            <p className="text-xs text-gray-500 text-center">{action.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

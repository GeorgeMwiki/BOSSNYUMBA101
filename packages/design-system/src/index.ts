/**
 * @bossnyumba/design-system
 *
 * Shared UI component library for the BOSSNYUMBA platform.
 * React + TypeScript + Tailwind CSS
 */

// ============================================================================
// Utilities
// ============================================================================
export * from './lib/utils';
export { cn } from './lib/utils';

// ============================================================================
// Core Components
// ============================================================================

// Button
export {
  Button,
  ButtonGroup,
  buttonVariants,
  type ButtonProps,
  type ButtonGroupProps,
} from './components/Button';

// Input & Textarea
export {
  Input,
  Textarea,
  type InputProps,
  type InputType,
  type TextareaProps,
} from './components/Input';

// Select (Basic, Searchable, Multi-select)
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
  SearchableSelect,
  MultiSelect,
  type SearchableSelectOption,
  type SearchableSelectProps,
  type MultiSelectProps,
} from './components/Select';

// Modal
export {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ConfirmationModal,
  type ModalProps,
  type ModalHeaderProps,
  type ModalBodyProps,
  type ModalFooterProps,
  type ConfirmationModalProps,
} from './components/Modal';

// Table
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  SortableTable,
  type TableProps,
  type TableHeaderProps,
  type TableBodyProps,
  type TableFooterProps,
  type TableRowProps,
  type TableHeadProps,
  type TableCellProps,
  type TableCaptionProps,
  type SortableColumn,
  type SortableTableProps,
  type SortDirection,
} from './components/Table';

// Card
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  CardImage,
  StatCard,
  type CardProps,
  type CardHeaderProps,
  type CardTitleProps,
  type CardFooterProps,
  type CardImageProps,
  type StatCardProps,
} from './components/Card';

// Badge
export {
  Badge,
  StatusBadge,
  BadgeGroup,
  badgeVariants,
  type BadgeProps,
  type StatusBadgeProps,
  type StatusType,
  type BadgeGroupProps,
} from './components/Badge';

// Alert
export {
  Alert,
  AlertTitle,
  AlertDescription,
  InlineAlert,
  BannerAlert,
  alertVariants,
  type AlertProps,
  type InlineAlertProps,
  type BannerAlertProps,
} from './components/Alert';

// Tabs
export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  SimpleTabs,
  VerticalTabs,
  type TabItem,
  type SimpleTabsProps,
  type VerticalTabsProps,
} from './components/Tabs';

// Sidebar
export {
  Sidebar,
  MobileSidebar,
  SidebarToggle,
  SidebarSection,
  type SidebarProps,
  type SidebarItem,
  type SidebarSection as SidebarSectionType,
  type MobileSidebarProps,
  type SidebarToggleProps,
  type SidebarSectionProps,
} from './components/Sidebar';

// DataGrid
export {
  DataGrid,
  SimpleDataGrid,
  type DataGridProps,
  type SimpleDataGridProps,
  type Column,
  type FilterConfig,
} from './components/DataGrid';

// ============================================================================
// Additional Components
// ============================================================================

// Label
export * from './components/Label';

// Dialog (Radix-based)
export * from './components/Dialog';

// Dropdown & DropdownMenu
export * from './components/Dropdown';
export * from './components/DropdownMenu';

// Toast
export * from './components/Toast';

// Tooltip
export * from './components/Tooltip';

// Separator
export * from './components/Separator';

// Avatar
export * from './components/Avatar';

// Skeleton
export * from './components/Skeleton';

// Spinner
export * from './components/Spinner';

// Pagination
export * from './components/Pagination';

// Progress
export * from './components/Progress';

// Empty State
export * from './components/Empty';

// Header
export * from './components/Header';

// Stat
export * from './components/Stat';

// ============================================================================
// Layout Components
// ============================================================================

export * from './components/layout/Container';
export * from './components/layout/PageHeader';

// ============================================================================
// Form Components
// ============================================================================

export * from './components/form/FormField';

// ============================================================================
// Data Display Components
// ============================================================================

export * from './components/data/DataTable';
export * from './components/data/StatCard';
export * from './components/data/EmptyState';

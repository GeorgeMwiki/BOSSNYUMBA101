/**
 * Response DTOs for API routes
 * Standardized shapes for consistent API responses
 */

/** Success response wrapper */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/** Error response wrapper */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/** Tenant list item DTO */
export interface TenantListItemDto {
  id: string;
  name: string;
  slug: string;
  status: string;
  contactEmail: string;
  createdAt: Date;
}

/** User list item DTO */
export interface UserListItemDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  role?: string;
  propertyAccess?: string[];
}

/** Login response DTO */
export interface LoginResponseDto {
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    role: string;
    tenantId: string;
  };
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
  role: string;
  permissions: string[];
  expiresAt: string;
}

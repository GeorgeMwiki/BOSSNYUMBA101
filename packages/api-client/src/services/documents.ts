/**
 * Documents API Service
 * Document management
 */

import { getApiClient, ApiResponse } from '../client';
import type { PaginationInfo } from '../types';
import { buildQueryParams } from '../types';

export type DocumentType =
  | 'LEASE'
  | 'ID_DOCUMENT'
  | 'INVOICE'
  | 'RECEIPT'
  | 'CONTRACT'
  | 'OTHER';

export type DocumentVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface Document {
  id: string;
  tenantId: string;
  type: DocumentType;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  verificationStatus: DocumentVerificationStatus;
  verifiedAt?: string;
  verifiedBy?: string;
  tags: string[];
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ListDocumentsParams {
  page?: number;
  pageSize?: number;
  type?: DocumentType;
  status?: DocumentVerificationStatus;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface CreateDocumentRequest {
  type: DocumentType;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  tags?: string[];
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface UpdateDocumentRequest {
  name?: string;
  tags?: string[];
  verificationStatus?: DocumentVerificationStatus;
}

export const documentsService = {
  /**
   * List documents with filters and pagination
   */
  async list(
    params?: ListDocumentsParams
  ): Promise<ApiResponse<Document[]> & { pagination?: PaginationInfo }> {
    const searchParams = buildQueryParams({
      page: params?.page,
      pageSize: params?.pageSize,
      type: params?.type,
      status: params?.status,
      relatedEntityType: params?.relatedEntityType,
      relatedEntityId: params?.relatedEntityId,
    });
    return getApiClient().get<Document[]>('/documents', { params: searchParams }) as Promise<
      ApiResponse<Document[]> & { pagination?: PaginationInfo }
    >;
  },

  /**
   * Get document by ID
   */
  async get(id: string): Promise<ApiResponse<Document>> {
    return getApiClient().get<Document>(`/documents/${id}`);
  },

  /**
   * Create document
   */
  async create(request: CreateDocumentRequest): Promise<ApiResponse<Document>> {
    return getApiClient().post<Document>('/documents', request);
  },

  /**
   * Update document
   */
  async update(id: string, request: UpdateDocumentRequest): Promise<ApiResponse<Document>> {
    return getApiClient().put<Document>(`/documents/${id}`, request);
  },

  /**
   * Delete document
   */
  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    return getApiClient().delete<{ message: string }>(`/documents/${id}`);
  },
};

// ============================================================================
// Customer-app facade: tenant-scoped list + multipart upload + download URL
// ============================================================================

export interface ListCustomerDocumentsParams {
  tenantId: string;
  page?: number;
  pageSize?: number;
  category?: string;
}

export interface UploadDocumentRequest {
  file: File | Blob;
  category: string;
  filename?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  tags?: string[];
  onProgress?: (progress: { loaded: number; total: number; percent: number }) => void;
  baseUrl?: string;
  token?: string;
}

export interface DownloadUrlResponse {
  url: string;
  expiresAt?: string;
}

export const documents = {
  /**
   * List documents for a specific tenant. Thin wrapper around the core
   * list endpoint that always injects the provided `tenantId`.
   */
  async listDocuments({
    tenantId,
    page,
    pageSize,
    category,
  }: ListCustomerDocumentsParams): Promise<
    ApiResponse<Document[]> & { pagination?: PaginationInfo }
  > {
    const searchParams = buildQueryParams({
      tenantId,
      page,
      pageSize,
      category,
    });
    return getApiClient().get<Document[]>('/documents', searchParams) as Promise<
      ApiResponse<Document[]> & { pagination?: PaginationInfo }
    >;
  },

  /**
   * Upload a document via multipart/form-data. Emits progress via the
   * optional `onProgress` callback (uses XHR under the hood so progress
   * events are available).
   *
   * Wraps `POST /documents/upload`.
   */
  uploadDocument({
    file,
    category,
    filename,
    relatedEntityType,
    relatedEntityId,
    tags,
    onProgress,
    baseUrl,
    token,
  }: UploadDocumentRequest): Promise<ApiResponse<Document>> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file, filename);
      formData.append('category', category);
      if (relatedEntityType) formData.append('relatedEntityType', relatedEntityType);
      if (relatedEntityId) formData.append('relatedEntityId', relatedEntityId);
      if (tags && tags.length) formData.append('tags', JSON.stringify(tags));

      // Determine endpoint: prefer explicit baseUrl, otherwise derive from the
      // singleton client's configuration by reading accessToken + a relative
      // fallback. Tests can inject `baseUrl`/`token` directly.
      const url = `${(baseUrl ?? '').replace(/\/$/, '')}/documents/upload`;
      const authToken = token ?? getApiClient().getAccessToken();

      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      if (authToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      }
      xhr.setRequestHeader('Accept', 'application/json');

      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            onProgress({
              loaded: event.loaded,
              total: event.total,
              percent: Math.round((event.loaded / event.total) * 100),
            });
          }
        });
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const body = xhr.responseText ? JSON.parse(xhr.responseText) : {};
            if ('success' in body) {
              resolve(body as ApiResponse<Document>);
            } else {
              resolve({ success: true, data: (body.data ?? body) as Document });
            }
          } catch (err) {
            reject(err);
          }
        } else {
          let message = `Upload failed with status ${xhr.status}`;
          try {
            const body = JSON.parse(xhr.responseText || '{}');
            message = body?.error?.message ?? body?.message ?? message;
          } catch {
            // ignore parse error
          }
          reject(new Error(message));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.onabort = () => reject(new Error('Upload aborted'));

      xhr.send(formData);
    });
  },

  /**
   * Fetch a signed/time-bound download URL for a document.
   * Wraps `GET /documents/:id/download-url`.
   */
  async getDownloadUrl(docId: string): Promise<ApiResponse<DownloadUrlResponse>> {
    return getApiClient().get<DownloadUrlResponse>(`/documents/${docId}/download-url`);
  },
};

export type CustomerDocumentsService = typeof documents;

/**
 * Chat API Service
 *
 * Thin convenience facade over the messaging service that exposes a
 * thread-centric API (`threadId` + `body`) for use by customer-app chat
 * surfaces. Prefer this module from UI code when the product language is
 * "thread" rather than "conversation".
 */

import { getApiClient, ApiResponse } from '../client';
import type { PaginationInfo } from '../types';
import { buildQueryParams } from '../types';
import type { Message } from './messaging';

export interface SendChatMessageRequest {
  threadId: string;
  body: string;
  attachments?: Array<{ type: string; url: string; filename: string }>;
}

export interface ListChatMessagesParams {
  threadId: string;
  limit?: number;
  before?: string;
  after?: string;
}

export const chat = {
  /**
   * Send a message to a chat thread.
   *
   * Wraps `POST /messaging/conversations/:threadId/messages`.
   */
  async sendMessage({
    threadId,
    body,
    attachments,
  }: SendChatMessageRequest): Promise<ApiResponse<Message>> {
    return getApiClient().post<Message>(`/messaging/conversations/${threadId}/messages`, {
      content: body,
      attachments,
    });
  },

  /**
   * List messages in a chat thread, most recent first.
   */
  async listMessages({
    threadId,
    limit = 50,
    before,
    after,
  }: ListChatMessagesParams): Promise<
    ApiResponse<Message[]> & { pagination?: PaginationInfo }
  > {
    const params = buildQueryParams({
      pageSize: limit,
      before,
      after,
    });
    return getApiClient().get<Message[]>(
      `/messaging/conversations/${threadId}/messages`,
      params
    ) as Promise<ApiResponse<Message[]> & { pagination?: PaginationInfo }>;
  },

  /**
   * Mark the thread as read for the current user.
   */
  async markRead(threadId: string): Promise<ApiResponse<{ success: boolean }>> {
    return getApiClient().post<{ success: boolean }>(
      `/messaging/conversations/${threadId}/read`,
      {}
    );
  },
};

export type ChatService = typeof chat;

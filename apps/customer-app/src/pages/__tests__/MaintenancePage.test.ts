/**
 * MaintenancePage wiring tests
 *
 * These tests validate the api-client layer the MaintenancePage consumes.
 * The page calls `maintenanceService.createTicket` / `listTickets` / `closeTicket`
 * with the shape documented below, so we verify that:
 *   1. Ticket creation produces the expected POST body + path.
 *   2. Listing open tickets produces the expected GET path + params.
 *   3. Close action hits the right endpoint.
 *   4. Loading + error propagation from the underlying client.
 *
 * We avoid DOM-level rendering because the customer-app test environment
 * does not ship jsdom / @testing-library, and the task mandate forbids
 * modifying package.json.
 */

import { describe, it, expect, beforeEach, beforeAll, vi, afterEach } from 'vitest';
import {
  initializeApiClient,
  getApiClient,
  maintenanceService,
} from '@bossnyumba/api-client';

beforeAll(() => {
  initializeApiClient({ baseUrl: 'http://test.local' });
});

describe('MaintenancePage api-client wiring', () => {
  let getSpy: ReturnType<typeof vi.spyOn>;
  let postSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    const client = getApiClient();
    getSpy = vi
      .spyOn(client, 'get')
      .mockResolvedValue({ data: [] } as never);
    postSpy = vi
      .spyOn(client, 'post')
      .mockResolvedValue({ data: {} } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createTicket', () => {
    it('calls createTicket with the exact payload shape the form builds', async () => {
      postSpy.mockResolvedValueOnce({ data: { id: 'ticket_1' } } as never);

      // Identical to what MaintenancePage.handleSubmit constructs.
      const res = await maintenanceService.createTicket({
        tenantId: 'tenant-123',
        title: 'Leaking sink',
        description: 'Kitchen sink is leaking badly',
        category: 'plumbing',
        priority: 'high',
        photos: [
          { url: 'blob:1', filename: 'sink.jpg', type: 'photo' },
          { url: 'blob:2', filename: 'drip.jpg' },
        ],
      });

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [path, body] = postSpy.mock.calls[0] ?? [];
      expect(path).toBe('/api/maintenance/tickets');
      expect(body).toMatchObject({
        tenantId: 'tenant-123',
        title: 'Leaking sink',
        description: 'Kitchen sink is leaking badly',
        category: 'plumbing',
        priority: 'high',
        attachments: [
          { type: 'photo', url: 'blob:1', filename: 'sink.jpg' },
          { type: 'photo', url: 'blob:2', filename: 'drip.jpg' },
        ],
      });
      expect((res as { data: { id: string } }).data).toEqual({ id: 'ticket_1' });
    });

    it('sends empty attachments array when no photos attached', async () => {
      await maintenanceService.createTicket({
        tenantId: 'tenant-123',
        title: 'Broken light',
        description: 'Kitchen light does not turn on',
        category: 'electrical',
        priority: 'medium',
      });

      const [, body] = postSpy.mock.calls[0] ?? [];
      expect((body as { attachments: unknown[] }).attachments).toEqual([]);
    });

    it('bubbles errors from createTicket (error state)', async () => {
      postSpy.mockRejectedValueOnce(new Error('validation failed'));

      await expect(
        maintenanceService.createTicket({
          tenantId: 'tenant-123',
          title: 'x',
          description: 'y',
          category: 'plumbing',
          priority: 'low',
        })
      ).rejects.toThrow('validation failed');
    });
  });

  describe('listTickets', () => {
    it('calls listTickets with tenantId and status=open', async () => {
      await maintenanceService.listTickets({
        tenantId: 'tenant-123',
        status: 'open',
      });

      expect(getSpy).toHaveBeenCalledTimes(1);
      const [path, options] = getSpy.mock.calls[0] ?? [];
      expect(path).toBe('/api/maintenance/tickets');
      expect(options).toEqual({
        params: {
          tenantId: 'tenant-123',
          limit: '20',
          page: '1',
          status: 'open',
        },
      });
    });

    it('returns a resolved list (loading state completes successfully)', async () => {
      getSpy.mockResolvedValueOnce({
        data: [
          { id: 't1', title: 'Leak', status: 'open' },
          { id: 't2', title: 'No power', status: 'in_progress' },
        ],
      } as never);

      const res = await maintenanceService.listTickets({
        tenantId: 'tenant-123',
        status: 'open',
      });

      expect((res as { data: unknown[] }).data).toHaveLength(2);
    });

    it('bubbles errors from listTickets (error state)', async () => {
      getSpy.mockRejectedValueOnce(new Error('network down'));

      await expect(
        maintenanceService.listTickets({
          tenantId: 'tenant-123',
          status: 'open',
        })
      ).rejects.toThrow('network down');
    });
  });

  describe('closeTicket', () => {
    it('posts to the close endpoint with the ticket id', async () => {
      await maintenanceService.closeTicket({ ticketId: 't1' });

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [path, body] = postSpy.mock.calls[0] ?? [];
      expect(path).toBe('/api/maintenance/tickets/t1/close');
      expect(body).toEqual({ resolutionNotes: undefined });
    });

    it('bubbles errors from closeTicket', async () => {
      postSpy.mockRejectedValueOnce(new Error('forbidden'));

      await expect(
        maintenanceService.closeTicket({ ticketId: 't1' })
      ).rejects.toThrow('forbidden');
    });
  });
});

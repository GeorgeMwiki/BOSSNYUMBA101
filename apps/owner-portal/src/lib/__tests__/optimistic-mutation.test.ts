/**
 * optimistic-mutation — onMutate/onError/onSettled lifecycle test.
 */
import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

import { buildOptimisticMutation } from '../optimistic-mutation';

interface LeaseRow {
  readonly id: string;
  readonly status: string;
}

describe('buildOptimisticMutation', () => {
  it('applies optimistic update on mutate and rolls back on error', async () => {
    const queryClient = new QueryClient();
    const queryKey = ['leases', 'mine'] as const;
    const initial: LeaseRow[] = [
      { id: 'l-1', status: 'active' },
      { id: 'l-2', status: 'active' },
    ];
    queryClient.setQueryData(queryKey, initial);

    const mutationFn = vi.fn().mockRejectedValueOnce(new Error('boom'));

    const options = buildOptimisticMutation<LeaseRow[], { leaseId: string }>({
      queryClient,
      queryKey: [...queryKey],
      mutationFn,
      applyOptimistic: (prev, variables) =>
        prev?.map((l) =>
          l.id === variables.leaseId ? { ...l, status: 'pending_termination' } : l,
        ),
    });

    // Simulate onMutate manually since we are not running react-query.
    const context = await options.onMutate?.({ leaseId: 'l-1' });
    const optimistic = queryClient.getQueryData<LeaseRow[]>([...queryKey]);
    expect(optimistic?.[0]?.status).toBe('pending_termination');

    // Simulate onError rollback.
    options.onError?.(new Error('boom'), { leaseId: 'l-1' }, context);
    const rolledBack = queryClient.getQueryData<LeaseRow[]>([...queryKey]);
    expect(rolledBack?.[0]?.status).toBe('active');
  });

  it('returns undefined-safe context when cache is empty', async () => {
    const queryClient = new QueryClient();
    const queryKey = ['leases', 'mine'] as const;
    const options = buildOptimisticMutation<LeaseRow[], { leaseId: string }>({
      queryClient,
      queryKey: [...queryKey],
      mutationFn: vi.fn(),
      applyOptimistic: (prev) => prev,
    });
    const context = await options.onMutate?.({ leaseId: 'x' });
    expect(context?.previous).toBeUndefined();
  });
});

/**
 * AskPanel — UI behaviour tests.
 *
 * Uses the panel's `_fetch*` / `_post*` injection points so we don't
 * have to mock fetch globally.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AskPanel } from '../components/AskPanel';
import type { AskAnswer, AskChip } from '../lib/ask-client';

const CHIPS: AskChip[] = [
  {
    id: 'lease-renewal',
    label: 'Discuss renewal',
    prompt: 'My lease is ending soon. Walk me through my options.',
    priority: 100,
    reason: 'lease ends in 30 days',
  },
  {
    id: 'default-tenant-rights',
    label: 'My tenant rights',
    prompt: 'What are my main rights as a tenant?',
    priority: 15,
    reason: 'role default',
  },
];

function buildAnswer(overrides: Partial<AskAnswer> = {}): AskAnswer {
  return {
    answer: 'Sample answer body.',
    answerId: 'ans_abc12345',
    intent: 'lease-question',
    citations: [],
    suggestedFollowUps: ['What about deposit?'],
    evidence: [],
    redactedFields: [],
    deniedSnippetIds: [],
    ...overrides,
  };
}

describe('AskPanel', () => {
  it('renders starting-point chips returned by the fetcher', async () => {
    const fetcher = vi.fn().mockResolvedValue({ chips: CHIPS });
    render(
      <AskPanel
        _fetchStartingPoints={fetcher}
        _postAsk={vi.fn()}
        _postFeedback={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Discuss renewal')).toBeInTheDocument();
    });
    expect(screen.getByText('My tenant rights')).toBeInTheDocument();
  });

  it('clicking a chip submits the chip prompt', async () => {
    const fetcher = vi.fn().mockResolvedValue({ chips: CHIPS });
    const asker = vi.fn().mockResolvedValue(buildAnswer());
    render(
      <AskPanel
        _fetchStartingPoints={fetcher}
        _postAsk={asker}
        _postFeedback={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Discuss renewal')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Discuss renewal'));
    await waitFor(() => {
      expect(asker).toHaveBeenCalledTimes(1);
    });
    expect(asker.mock.calls[0]![0]).toBe(
      'My lease is ending soon. Walk me through my options.',
    );
  });

  it('submitting the form posts the question + renders the answer', async () => {
    const fetcher = vi.fn().mockResolvedValue({ chips: [] });
    const asker = vi.fn().mockResolvedValue(
      buildAnswer({ answer: 'A specific answer to your question.' }),
    );
    render(
      <AskPanel
        _fetchStartingPoints={fetcher}
        _postAsk={asker}
        _postFeedback={vi.fn()}
      />,
    );
    const input = screen.getByTestId('ask-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'When does my lease end?' } });
    fireEvent.click(screen.getByTestId('ask-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('answer-text')).toHaveTextContent(
        'A specific answer to your question.',
      );
    });
    expect(asker).toHaveBeenCalledTimes(1);
    expect(asker.mock.calls[0]![0]).toBe('When does my lease end?');
  });

  it('feedback thumbs-up posts rating 5 to the feedback endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue({ chips: [] });
    const asker = vi.fn().mockResolvedValue(buildAnswer());
    const feedback = vi.fn().mockResolvedValue({ recorded: true });
    render(
      <AskPanel
        _fetchStartingPoints={fetcher}
        _postAsk={asker}
        _postFeedback={feedback}
      />,
    );
    const input = screen.getByTestId('ask-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'test question' } });
    fireEvent.click(screen.getByTestId('ask-submit'));
    await waitFor(() => screen.getByTestId('thumbs-up'));
    fireEvent.click(screen.getByTestId('thumbs-up'));
    await waitFor(() => expect(feedback).toHaveBeenCalledTimes(1));
    const call = feedback.mock.calls[0]![0];
    expect(call.rating).toBe(5);
    expect(call.answerId).toBe('ans_abc12345');
  });

  it('feedback thumbs-down posts rating 1', async () => {
    const fetcher = vi.fn().mockResolvedValue({ chips: [] });
    const asker = vi.fn().mockResolvedValue(buildAnswer());
    const feedback = vi.fn().mockResolvedValue({ recorded: true });
    render(
      <AskPanel
        _fetchStartingPoints={fetcher}
        _postAsk={asker}
        _postFeedback={feedback}
      />,
    );
    fireEvent.change(screen.getByTestId('ask-input'), {
      target: { value: 'test question' },
    });
    fireEvent.click(screen.getByTestId('ask-submit'));
    await waitFor(() => screen.getByTestId('thumbs-down'));
    fireEvent.click(screen.getByTestId('thumbs-down'));
    await waitFor(() => expect(feedback).toHaveBeenCalledTimes(1));
    expect(feedback.mock.calls[0]![0].rating).toBe(1);
  });

  it('renders error inline when /v1/ask fails', async () => {
    const fetcher = vi.fn().mockResolvedValue({ chips: [] });
    const asker = vi.fn().mockRejectedValue(new Error('Backend down'));
    render(
      <AskPanel
        _fetchStartingPoints={fetcher}
        _postAsk={asker}
        _postFeedback={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('ask-input'), {
      target: { value: 'hello' },
    });
    fireEvent.click(screen.getByTestId('ask-submit'));
    await waitFor(() => {
      expect(screen.getByText(/backend down/i)).toBeInTheDocument();
    });
  });

  it('renders chips-error when starting-points fetch fails', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('No session'));
    render(
      <AskPanel
        _fetchStartingPoints={fetcher}
        _postAsk={vi.fn()}
        _postFeedback={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('chips-error')).toBeInTheDocument();
    });
  });

  it('submit button is disabled for too-short questions', async () => {
    const fetcher = vi.fn().mockResolvedValue({ chips: [] });
    render(
      <AskPanel
        _fetchStartingPoints={fetcher}
        _postAsk={vi.fn()}
        _postFeedback={vi.fn()}
      />,
    );
    const submit = screen.getByTestId('ask-submit') as HTMLButtonElement;
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByTestId('ask-input'), {
      target: { value: 'a' },
    });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByTestId('ask-input'), {
      target: { value: 'hi' },
    });
    expect(submit).not.toBeDisabled();
  });

  it('renders citations as collapsible footnotes', async () => {
    const fetcher = vi.fn().mockResolvedValue({ chips: [] });
    const asker = vi.fn().mockResolvedValue(
      buildAnswer({
        citations: [
          { id: 'c1', label: 'Lease section 4.2', source: 'snippet:c1' },
        ],
      }),
    );
    render(
      <AskPanel
        _fetchStartingPoints={fetcher}
        _postAsk={asker}
        _postFeedback={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('ask-input'), {
      target: { value: 'test' },
    });
    fireEvent.click(screen.getByTestId('ask-submit'));
    await waitFor(() => screen.getByTestId('answer-citations'));
    const cite = screen.getByLabelText(/Citation 1/);
    expect(cite).toBeInTheDocument();
    fireEvent.click(cite);
    expect(screen.getByText(/Lease section 4.2/)).toBeInTheDocument();
  });
});

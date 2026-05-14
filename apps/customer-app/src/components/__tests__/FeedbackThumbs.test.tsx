import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { FeedbackThumbs } from '../FeedbackThumbs';

describe('FeedbackThumbs', () => {
  it('renders both 👍 and 👎 buttons', () => {
    const onFeedback = vi.fn().mockResolvedValue(undefined);
    render(<FeedbackThumbs turnId="t1" onFeedback={onFeedback} />);
    expect(screen.getByLabelText('Thumbs up')).toBeInTheDocument();
    expect(screen.getByLabelText('Thumbs down')).toBeInTheDocument();
  });

  it("calls onFeedback('up') when 👍 is clicked", async () => {
    const onFeedback = vi.fn().mockResolvedValue(undefined);
    render(<FeedbackThumbs turnId="t1" onFeedback={onFeedback} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Thumbs up'));
    });
    expect(onFeedback).toHaveBeenCalledTimes(1);
    expect(onFeedback).toHaveBeenCalledWith('up', undefined);
  });

  it('reveals the reason input after 👎 is clicked', async () => {
    const onFeedback = vi.fn().mockResolvedValue(undefined);
    render(<FeedbackThumbs turnId="t1" onFeedback={onFeedback} />);
    expect(screen.queryByLabelText('Feedback reason')).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Thumbs down'));
    });
    expect(onFeedback).toHaveBeenCalledWith('down', undefined);
    expect(screen.getByLabelText('Feedback reason')).toBeInTheDocument();
  });

  it("submits with the reason text via onFeedback('down', reason)", async () => {
    const onFeedback = vi.fn().mockResolvedValue(undefined);
    render(<FeedbackThumbs turnId="t1" onFeedback={onFeedback} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Thumbs down'));
    });
    const input = screen.getByLabelText('Feedback reason') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Citation was wrong' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    expect(onFeedback).toHaveBeenCalledTimes(2);
    expect(onFeedback).toHaveBeenLastCalledWith('down', 'Citation was wrong');
  });

  it('restores buttons + shows a toast when onFeedback rejects', async () => {
    const onFeedback = vi
      .fn()
      .mockRejectedValueOnce(new Error('Server down'))
      .mockResolvedValueOnce(undefined);
    render(<FeedbackThumbs turnId="t1" onFeedback={onFeedback} />);
    const upBtn = screen.getByLabelText('Thumbs up') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(upBtn);
    });
    await waitFor(() => {
      expect(screen.getByTestId('feedback-error')).toHaveTextContent('Server down');
    });
    // Buttons restored — should be clickable again.
    expect(upBtn.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(upBtn);
    });
    expect(onFeedback).toHaveBeenCalledTimes(2);
  });

  it('disables both buttons when the `disabled` prop is true', () => {
    const onFeedback = vi.fn().mockResolvedValue(undefined);
    render(<FeedbackThumbs turnId="t1" onFeedback={onFeedback} disabled />);
    const up = screen.getByLabelText('Thumbs up') as HTMLButtonElement;
    const down = screen.getByLabelText('Thumbs down') as HTMLButtonElement;
    expect(up.disabled).toBe(true);
    expect(down.disabled).toBe(true);
    fireEvent.click(up);
    fireEvent.click(down);
    expect(onFeedback).not.toHaveBeenCalled();
  });

  it('disables both buttons while a submit is in flight', async () => {
    let resolve!: () => void;
    const onFeedback = vi.fn(
      () => new Promise<void>((r) => { resolve = r; }),
    );
    render(<FeedbackThumbs turnId="t1" onFeedback={onFeedback} />);
    const up = screen.getByLabelText('Thumbs up') as HTMLButtonElement;
    const down = screen.getByLabelText('Thumbs down') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(up);
    });
    expect(up.disabled).toBe(true);
    expect(down.disabled).toBe(true);
    await act(async () => {
      resolve();
    });
    await waitFor(() => {
      expect(up.disabled).toBe(false);
    });
  });
});

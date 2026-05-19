import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ChatTimeline } from './ChatTimeline';
import { chartPart, genUiBlock, tablePart, textBlock, turn } from '../__tests__/fixtures';

describe('<ChatTimeline>', () => {
  it('renders every turn with its role label', () => {
    const turns = [
      turn('t-1', 'owner', [textBlock('b-1', 'Hello MD')]),
      turn('t-2', 'md', [textBlock('b-2', 'Hello owner')]),
    ];
    render(<ChatTimeline turns={turns} viewportWidthPx={1024} />);
    const articles = screen.getAllByTestId('chat-turn');
    expect(articles).toHaveLength(2);
    expect(articles[0]?.dataset.role).toBe('owner');
    expect(articles[1]?.dataset.role).toBe('md');
  });

  it('mixes prose + genui in the order they appear', () => {
    const turns = [
      turn('t-1', 'md', [
        textBlock('b-1', 'Here is the cashflow.'),
        genUiBlock('b-2', chartPart(), 'cashflow-2026'),
        textBlock('b-3', 'As you can see [ref:b-2|in the chart above]'),
      ]),
    ];
    render(<ChatTimeline turns={turns} viewportWidthPx={1024} />);
    const blocks = screen.getByTestId('chat-turn').querySelectorAll('[data-block-id]');
    expect(Array.from(blocks).map((el) => el.getAttribute('data-block-id'))).toEqual([
      'b-1',
      'b-2',
      'b-3',
    ]);
  });

  it('renders ref tokens as clickable scroll anchors', () => {
    const turns = [
      turn('t-1', 'md', [
        genUiBlock('b-chart', chartPart(), 'cashflow'),
        textBlock('b-text', 'See [ref:b-chart|cashflow] above'),
      ]),
    ];
    const onRef = vi.fn();
    render(<ChatTimeline turns={turns} viewportWidthPx={1024} onReferenceClick={onRef} />);
    const link = screen.getByTestId('chat-timeline-ref');
    fireEvent.click(link);
    expect(onRef).toHaveBeenCalledWith('b-chart');
  });

  it('emits a pin event when the pin button is clicked', () => {
    const block = genUiBlock('b-1', chartPart());
    const t = turn('t-1', 'md', [block]);
    const onPin = vi.fn();
    render(<ChatTimeline turns={[t]} viewportWidthPx={1024} onPin={onPin} />);
    fireEvent.click(screen.getByTestId('chat-block-pin'));
    expect(onPin).toHaveBeenCalledWith(block, t);
  });

  it('collapses large genui parts on narrow viewports', () => {
    const turns = [turn('t-1', 'md', [genUiBlock('b-1', chartPart())])];
    render(<ChatTimeline turns={turns} viewportWidthPx={400} />);
    expect(screen.getByTestId('chat-block-genui-collapsed')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-block-pin')).not.toBeInTheDocument();
  });

  it('expands a collapsed block when the user taps to expand', () => {
    const turns = [turn('t-1', 'md', [genUiBlock('b-1', tablePart())])];
    render(<ChatTimeline turns={turns} viewportWidthPx={400} />);
    fireEvent.click(screen.getByTestId('chat-block-genui-expand'));
    expect(screen.queryByTestId('chat-block-genui-collapsed')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-block-genui')).toBeInTheDocument();
  });

  it('renders a thinking block with summary hidden by default', () => {
    const turns = [
      turn('t-1', 'md', [
        { kind: 'thinking', id: 'b-th', summary: 'planning the reply' },
        textBlock('b-1', 'Here goes'),
      ]),
    ];
    render(<ChatTimeline turns={turns} viewportWidthPx={1024} />);
    const block = screen.getByTestId('chat-block-thinking');
    expect(block).toBeInTheDocument();
    expect(block.hasAttribute('open')).toBe(false);
  });

  it('renders a voice block with transcript', () => {
    const turns = [
      turn('t-1', 'owner', [
        {
          kind: 'voice',
          id: 'b-v',
          audio: { url: 'blob:test', mimeType: 'audio/webm', durationMs: 4000 },
          transcript: 'what is occupancy',
        },
      ]),
    ];
    render(<ChatTimeline turns={turns} viewportWidthPx={1024} />);
    expect(screen.getByTestId('chat-block-voice')).toBeInTheDocument();
    expect(screen.getByTestId('chat-block-voice-transcript')).toHaveTextContent('what is occupancy');
  });

  it('honors the custom genui slot renderer', () => {
    const turns = [turn('t-1', 'md', [genUiBlock('b-1', chartPart())])];
    render(
      <ChatTimeline
        turns={turns}
        viewportWidthPx={1024}
        renderGenUi={({ part, blockId, turnId }) => (
          <div data-testid="slot-output" data-block-id={blockId} data-turn-id={turnId}>
            slot:{part.kind}
          </div>
        )}
      />,
    );
    const slot = screen.getByTestId('slot-output');
    expect(slot).toHaveTextContent('slot:chart-vega');
    expect(slot.dataset.turnId).toBe('t-1');
    expect(slot.dataset.blockId).toBe('b-1');
  });

  it('exposes a reference block (cross-reference card) as a scroll link', () => {
    const onRef = vi.fn();
    const turns = [
      turn('t-1', 'md', [
        genUiBlock('b-chart', chartPart()),
        { kind: 'reference', id: 'b-ref', refToBlockId: 'b-chart', label: 'cashflow' },
      ]),
    ];
    render(<ChatTimeline turns={turns} viewportWidthPx={1024} onReferenceClick={onRef} />);
    fireEvent.click(screen.getByTestId('chat-block-reference'));
    expect(onRef).toHaveBeenCalledWith('b-chart');
  });
});

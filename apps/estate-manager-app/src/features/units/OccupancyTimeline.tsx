/**
 * OccupancyTimeline (NEW 22)
 *
 * Gantt-style occupancy visualization skeleton. Uses simple HTML bars
 * (no charting dependency) — swap for recharts or visx once a charting
 * library is standardised at the monorepo level.
 *
 * Click a segment to drill down into the occupancy period detail page;
 * the drill-down callback is stubbed via props so parent routes can
 * navigate without this component knowing about the router.
 */

import * as React from 'react';

export interface OccupancyTimelineSegment {
  readonly id: string;
  readonly customerId: string | null;
  readonly customerName: string | null;
  readonly from: string; // ISO
  readonly to: string | null; // ISO
  readonly status:
    | 'active'
    | 'notice_given'
    | 'moved_out'
    | 'evicted'
    | 'abandoned'
    | 'vacant';
  readonly rent: { readonly amount: number; readonly currency: string } | null;
  readonly exitReason: string | null;
}

export interface OccupancyTimelineProps {
  readonly unitId: string;
  readonly segments: readonly OccupancyTimelineSegment[];
  readonly onSegmentClick?: (segmentId: string) => void;
  readonly onExportPng?: () => void;
  readonly onExportPdf?: () => void;
}

const STATUS_COLORS: Record<OccupancyTimelineSegment['status'], string> = {
  active: '#38a169',
  notice_given: '#d69e2e',
  moved_out: '#718096',
  evicted: '#c53030',
  abandoned: '#9b2c2c',
  vacant: '#cbd5e0',
};

function parseDate(iso: string): number {
  return new Date(iso).getTime();
}

export const OccupancyTimeline: React.FC<OccupancyTimelineProps> = (props) => {
  const { unitId, segments, onSegmentClick, onExportPng, onExportPdf } = props;

  const { minTs, maxTs } = React.useMemo(() => {
    if (segments.length === 0) {
      const now = Date.now();
      return { minTs: now, maxTs: now + 1 };
    }
    const froms = segments.map((s) => parseDate(s.from));
    const tos = segments.map((s) =>
      s.to ? parseDate(s.to) : Date.now()
    );
    return {
      minTs: Math.min(...froms),
      maxTs: Math.max(...tos),
    };
  }, [segments]);

  const span = Math.max(1, maxTs - minTs);

  return (
    <div
      className="occupancy-timeline"
      data-unit-id={unitId}
      style={{ padding: 12 }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <h3>Occupancy timeline — unit {unitId}</h3>
        <div>
          <button type="button" onClick={onExportPng}>
            Export PNG
          </button>
          <button type="button" onClick={onExportPdf} style={{ marginLeft: 8 }}>
            Export PDF
          </button>
        </div>
      </header>

      {segments.length === 0 ? (
        <p>No occupancy history recorded.</p>
      ) : (
        <div
          style={{
            position: 'relative',
            height: 48,
            background: '#f7fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 4,
            marginTop: 12,
          }}
        >
          {segments.map((seg) => {
            const left = ((parseDate(seg.from) - minTs) / span) * 100;
            const toTs = seg.to ? parseDate(seg.to) : Date.now();
            const width = Math.max(
              0.5,
              ((toTs - parseDate(seg.from)) / span) * 100
            );
            return (
              <button
                key={seg.id}
                type="button"
                onClick={() => onSegmentClick?.(seg.id)}
                title={`${seg.customerName ?? 'Vacant'} · ${seg.from} → ${
                  seg.to ?? 'present'
                }`}
                style={{
                  position: 'absolute',
                  top: 4,
                  height: 40,
                  left: `${left}%`,
                  width: `${width}%`,
                  background: STATUS_COLORS[seg.status],
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: 2,
                  cursor: 'pointer',
                  color: '#fff',
                  fontSize: 11,
                  padding: 2,
                  overflow: 'hidden',
                  textAlign: 'left',
                }}
              >
                {seg.customerName ?? 'Vacant'}
              </button>
            );
          })}
        </div>
      )}

      <ul style={{ fontSize: 12, marginTop: 12, paddingLeft: 16 }}>
        {segments.map((seg) => (
          <li key={`legend-${seg.id}`}>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                background: STATUS_COLORS[seg.status],
                marginRight: 6,
              }}
            />
            {seg.customerName ?? 'Vacant'} — {seg.from} →{' '}
            {seg.to ?? 'present'}
            {seg.rent
              ? ` · ${seg.rent.amount} ${seg.rent.currency}`
              : ''}
            {seg.exitReason ? ` · Exit: ${seg.exitReason}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default OccupancyTimeline;

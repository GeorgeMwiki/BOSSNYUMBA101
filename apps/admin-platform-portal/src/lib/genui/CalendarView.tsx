'use client';

/**
 * 9. calendar — FullCalendar v6 inline.
 *
 * Dependencies:
 *   - @fullcalendar/react ^6.1.15
 *   - @fullcalendar/daygrid ^6.1.15
 *   - @fullcalendar/timegrid ^6.1.15
 */

import dynamic from 'next/dynamic';

import type { AgUiUiPartByKind } from './types';
import { Frame, GenUiError } from './Frame';
import { CalendarPartSchema } from './schemas';

export type CalendarViewProps = AgUiUiPartByKind<'calendar'>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CalendarInner = dynamic<any>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  () => import('./CalendarInner.js').then((m: any) => m.CalendarInner),
  {
    ssr: false,
    loading: () => <span className="text-xs text-muted-foreground">loading calendar…</span>,
  },
);

export function CalendarView(props: CalendarViewProps): JSX.Element {
  const parsed = CalendarPartSchema.safeParse(props);
  if (!parsed.success) {
    return (
      <GenUiError
        kind="calendar"
        message={parsed.error.issues.map((i) => i.message).join('; ')}
      />
    );
  }
  return (
    <Frame kind="calendar" {...(props.title ? { title: props.title } : {})}>
      <CalendarInner
        events={props.events}
        view={props.view ?? 'dayGrid'}
      />
    </Frame>
  );
}

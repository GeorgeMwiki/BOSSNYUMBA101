'use client';

/**
 * CalendarInner — the FullCalendar slice. Loaded with ssr:false.
 */

// @ts-ignore — module added at integration time
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import FullCalendarMod from '@fullcalendar/react';
// @ts-ignore — module added at integration time
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import dayGridPlugin from '@fullcalendar/daygrid';
// @ts-ignore — module added at integration time
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import timeGridPlugin from '@fullcalendar/timegrid';

import type { CalendarEvent } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FullCalendar = FullCalendarMod as any;

export interface CalendarInnerProps {
  readonly events: ReadonlyArray<CalendarEvent>;
  readonly view: 'dayGrid' | 'timeGrid' | 'list';
}

const VIEW_NAME: Record<string, string> = {
  dayGrid: 'dayGridMonth',
  timeGrid: 'timeGridWeek',
  list: 'listWeek',
};

export function CalendarInner(props: CalendarInnerProps): JSX.Element {
  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin]}
      initialView={VIEW_NAME[props.view]}
      events={props.events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        color: e.color,
      }))}
      height="auto"
    />
  );
}

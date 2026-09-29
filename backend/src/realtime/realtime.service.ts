import { Injectable, type MessageEvent } from '@nestjs/common';
import { filter, map, merge, interval, Observable, Subject } from 'rxjs';

export interface WallEvent {
  eventId: string;
  type: 'photo.published' | 'photo.removed';
  data: object;
}

/**
 * In-process pub/sub for the live wall (Server-Sent Events).
 * Works for a single API instance; with several instances, back it with
 * Redis pub/sub or Supabase Realtime and keep the same publish/stream API.
 */
@Injectable()
export class RealtimeService {
  private readonly bus = new Subject<WallEvent>();

  publish(event: WallEvent) {
    this.bus.next(event);
  }

  /** Stream for one event's wall, with a heartbeat so proxies don't close idle connections. */
  stream(eventId: string): Observable<MessageEvent> {
    const updates = this.bus.pipe(
      filter(e => e.eventId === eventId),
      map((e): MessageEvent => ({ type: e.type, data: e.data })),
    );
    const heartbeat = interval(25_000).pipe(map((): MessageEvent => ({ type: 'ping', data: '' })));
    return merge(updates, heartbeat);
  }
}

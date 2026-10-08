import type { Prisma } from '../generated/prisma/client.js';
import { lower } from '../common/serialize.js';
import type { StorageService } from '../storage/storage.service.js';

export const REACTION_EMOJIS = ['❤️', '😂', '🔥', '😍', '👏'] as const;

export const photoInclude = {
  _count: { select: { comments: true } },
  reactions: { select: { emoji: true, guestId: true } },
} satisfies Prisma.PhotoInclude;

type PhotoWithCounts = Prisma.PhotoGetPayload<{ include: typeof photoInclude }>;

/** Photo as the wall shows it: reaction counts per emoji and the viewer's own reaction. */
export function photoDto(photo: PhotoWithCounts, storage: StorageService, viewerGuestId?: string) {
  const reactions: Record<string, number> = {};
  for (const r of photo.reactions) reactions[r.emoji] = (reactions[r.emoji] ?? 0) + 1;
  return {
    id: photo.id,
    eventId: photo.eventId,
    url: storage.url(photo.storageKey),
    thumbUrl: storage.url(photo.thumbKey ?? photo.storageKey),
    author: photo.authorName ?? 'Guest',
    caption: photo.caption,
    status: lower(photo.status),
    createdAt: photo.createdAt,
    reactions,
    totalReactions: photo.reactions.length,
    myReaction: viewerGuestId ? photo.reactions.find(r => r.guestId === viewerGuestId)?.emoji ?? null : null,
    commentCount: photo._count.comments,
    mine: !!viewerGuestId && photo.guestId === viewerGuestId,
  };
}
export type PhotoDto = ReturnType<typeof photoDto>;

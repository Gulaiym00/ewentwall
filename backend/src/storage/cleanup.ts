import type { PrismaService } from '../prisma/prisma.service.js';

const isStorageKey = (ref: string | null): ref is string => !!ref && !/^https?:\/\//.test(ref);

/**
 * Collects the files of these events (photos + covers) before the rows are deleted.
 * Call it first, delete the rows, then pass the result to `storage.deleteMany`
 * so a failed DB delete never leaves rows pointing at missing files.
 */
export async function eventFileKeys(prisma: PrismaService, eventIds: string[]): Promise<string[]> {
  if (!eventIds.length) return [];
  const [photos, events] = await Promise.all([
    prisma.photo.findMany({ where: { eventId: { in: eventIds } }, select: { storageKey: true } }),
    prisma.event.findMany({ where: { id: { in: eventIds } }, select: { coverUrl: true } }),
  ]);
  return [...photos.map(p => p.storageKey), ...events.map(e => e.coverUrl).filter(isStorageKey)];
}

/** Files owned by a user: their avatar and everything in their events. */
export async function userFileKeys(prisma: PrismaService, userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true, events: { select: { id: true } } } });
  if (!user) return [];
  const keys = await eventFileKeys(prisma, user.events.map(e => e.id));
  return isStorageKey(user.avatarUrl) ? [...keys, user.avatarUrl] : keys;
}

export { isStorageKey };

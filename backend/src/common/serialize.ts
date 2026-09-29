import type { User } from '../generated/prisma/client.js';
import type { StorageService } from '../storage/storage.service.js';

// The API speaks the frontend's vocabulary: enums in lower case ('organizer', 'active', 'en'),
// file references as absolute URLs.

export const lower = <T extends string>(v: T) => v.toLowerCase() as Lowercase<T>;
export const upper = <T extends string>(v: T) => v.toUpperCase() as Uppercase<T>;

/** Stored file references are either external URLs (Google avatars) or storage keys. */
export const fileUrl = (storage: StorageService, ref: string | null | undefined) =>
  !ref ? null : /^https?:\/\//.test(ref) ? ref : storage.url(ref);

export function userDto(user: User, storage: StorageService) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: lower(user.role),
    status: lower(user.status),
    avatarUrl: fileUrl(storage, user.avatarUrl),
    phone: user.phone,
    city: user.city,
    language: lower(user.language),
    hasPassword: user.passwordHash !== null,
    googleLinked: user.googleId !== null,
    notifications: {
      newPhotos: user.notifyNewPhotos,
      dailySummary: user.notifyDailySummary,
      reports: user.notifyReports,
      product: user.notifyProduct,
    },
    createdAt: user.createdAt,
    lastSeenAt: user.lastSeenAt,
  };
}
export type UserDto = ReturnType<typeof userDto>;

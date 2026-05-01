import type { UserRole } from '@/types';

export function canViewVideo(role?: UserRole | null) {
  return role === 'ADMIN' || role === 'MEMBER';
}

export function canSearchVideos(role?: UserRole | null) {
  return canViewVideo(role);
}

export function canDownloadVideo(role?: UserRole | null) {
  return canViewVideo(role);
}

export function canUploadVideo(role?: UserRole | null) {
  return role === 'ADMIN';
}

export function canEditVideo(role?: UserRole | null) {
  return role === 'ADMIN';
}

export function canDeleteVideo(role?: UserRole | null) {
  return role === 'ADMIN';
}


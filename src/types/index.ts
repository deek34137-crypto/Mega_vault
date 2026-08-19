export type MediaType = 'IMAGE' | 'VIDEO';

export type SupportedImageFormat = 'JPG' | 'JPEG' | 'PNG' | 'WEBP' | 'GIF' | 'HEIC';
export type SupportedVideoFormat = 'MP4' | 'MOV' | 'MKV' | 'WEBM';

export interface MediaItem {
  id: string;
  albumId: string;
  albumTitle?: string;
  folderPath?: string;
  fileHandle: string;
  fileName: string;
  mimeType: string;
  mediaType: MediaType;
  size: number;
  fileKey?: string;
  createdAt: string;
  thumbnailUrl?: string;
  streamUrl?: string;
  width?: number;
  height?: number;
  duration?: number; // for videos in seconds
  isFavorite?: boolean;
}

export interface Album {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  color?: string;
  icon?: string;
  megaUrl?: string;
  megaFolderHandle?: string;
  mediaCount: {
    total: number;
    images: number;
    videos: number;
  };
  subfolderCount?: number;
  status?: 'ACTIVE' | 'SYNCING' | 'UNAVAILABLE';
  createdAt: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'VIEWER';
  avatarUrl?: string;
}

export type SortOrder = 'newest' | 'oldest' | 'largest' | 'smallest' | 'alphabetical';
export type FilterMediaType = 'all' | 'images' | 'videos';

export interface GalleryFilterOptions {
  searchQuery: string;
  mediaType: FilterMediaType;
  sortBy: SortOrder;
}

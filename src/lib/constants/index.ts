export const APP_NAME = 'MegaVault';
export const APP_TAGLINE = 'Private Family & Personal Media Index';
export const APP_VERSION = '1.0.0';

export const NAV_ITEMS = [
  { label: 'Home', href: '/', icon: 'Home' },
  { label: 'Albums', href: '/albums', icon: 'FolderHeart' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
] as const;

export const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'];
export const SUPPORTED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'mkv', 'webm'];


export const MOCK_MEDIA = [
  {
    id: 'med-1',
    albumId: 'alb-1',
    fileHandle: 'h101',
    fileName: 'Sunset_Beach_Panorama.jpg',
    mimeType: 'image/jpeg',
    mediaType: 'IMAGE' as const,
    size: 4850000,
    createdAt: '2025-07-16T18:45:00Z',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    width: 3840,
    height: 2160,
    isFavorite: true,
  },
  {
    id: 'med-2',
    albumId: 'alb-1',
    fileHandle: 'h102',
    fileName: 'Coastal_Drone_Highlight.mp4',
    mimeType: 'video/mp4',
    mediaType: 'VIDEO' as const,
    size: 84500000,
    createdAt: '2025-07-16T19:10:00Z',
    thumbnailUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    duration: 142,
    isFavorite: false,
  },
  {
    id: 'med-3',
    albumId: 'alb-2',
    fileHandle: 'h103',
    fileName: 'Wedding_Ring_Exchange.png',
    mimeType: 'image/png',
    mediaType: 'IMAGE' as const,
    size: 6200000,
    createdAt: '2025-09-02T16:30:00Z',
    thumbnailUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80',
    width: 2048,
    height: 1536,
    isFavorite: true,
  },
  {
    id: 'med-4',
    albumId: 'alb-2',
    fileHandle: 'h104',
    fileName: 'First_Dance_Full.mp4',
    mimeType: 'video/mp4',
    mediaType: 'VIDEO' as const,
    size: 156000000,
    createdAt: '2025-09-02T20:15:00Z',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=800&q=80',
    duration: 215,
    isFavorite: true,
  },
  {
    id: 'med-5',
    albumId: 'alb-3',
    fileHandle: 'h105',
    fileName: 'Cake_Cutting_Moment.jpg',
    mimeType: 'image/jpeg',
    mediaType: 'IMAGE' as const,
    size: 3400000,
    createdAt: '2025-11-10T19:40:00Z',
    thumbnailUrl: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=800&q=80',
    width: 1920,
    height: 1080,
    isFavorite: false,
  },
  {
    id: 'med-6',
    albumId: 'alb-4',
    fileHandle: 'h106',
    fileName: 'Grandparents_Retrospective.webp',
    mimeType: 'image/webp',
    mediaType: 'IMAGE' as const,
    size: 2100000,
    createdAt: '2026-01-05T15:00:00Z',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=800&q=80',
    width: 1600,
    height: 1200,
    isFavorite: true,
  },
];

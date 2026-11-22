export type ProductAnnouncementActionType = 'enable-image' | 'enable-web-search' | 'open-models';

export interface ProductAnnouncementGalleryItem {
  id: string;
  src: string;
  alt: string;
  fallbackGradient: string;
}

export interface ProductAnnouncementData {
  id: string;
  storageVersion: number;
  maxViews: number;
  badge: string;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  actionType: ProductAnnouncementActionType;
  gallery: ProductAnnouncementGalleryItem[];
}

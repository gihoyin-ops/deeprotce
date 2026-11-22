export type ProductAnnouncementActionType = 'enable-image' | 'enable-web-search' | 'open-models';

export interface ProductAnnouncementGalleryItem {
  id: string;
  src: string;
  alt: string;
  label: string;
  prompt: string;
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
  highlights: string[];
  ctaLabel: string;
  actionType: ProductAnnouncementActionType;
  gallery: ProductAnnouncementGalleryItem[];
}

export interface ProductAnnouncementPromptSelection {
  prompt: string;
  enableImageGeneration?: boolean;
  enableWebSearch?: boolean;
}

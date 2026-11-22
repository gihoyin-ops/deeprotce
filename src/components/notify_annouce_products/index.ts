import imagesModelUpdateJson from './images-model-update.json';
import { type ProductAnnouncementData } from './types';

export { default as ProductAnnouncementCard } from './ProductAnnouncementCard';
export type {
  ProductAnnouncementActionType,
  ProductAnnouncementData,
  ProductAnnouncementGalleryItem,
  ProductAnnouncementPromptSelection,
} from './types';

const imagesModelUpdate: ProductAnnouncementData = imagesModelUpdateJson as ProductAnnouncementData;

export const PRODUCT_ANNOUNCEMENTS: ProductAnnouncementData[] = [imagesModelUpdate];
export const ACTIVE_PRODUCT_ANNOUNCEMENT: ProductAnnouncementData = imagesModelUpdate;

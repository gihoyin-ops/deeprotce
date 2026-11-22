export type MobileRightDrawerTab = 'chat' | 'search' | 'inbox';

export interface MobileDrawerHandle {
  setDragProgress: (progress: number) => void;
  snapOpen: () => void;
  snapClose: () => void;
  isOpen: () => boolean;
}

// settings utility helpers

export const formatStorageSize = (value: number | null) => {
  if (value === null) return 'Unavailable';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
};

// mobile menu section definitions
export const getMobileItemPosition = (sectionTitle: string, index: number, length: number) => {
  if (sectionTitle === 'Model & Services' && index >= 5) {
    return index === 5 ? 'top' : 'bottom';
  }
  if (sectionTitle === 'Model & Services' && index === 4) return 'bottom';
  if (length === 1) return 'single';
  if (index === 0) return 'top';
  if (index === length - 1) return 'bottom';
  return 'middle';
};

export const getMobileItemRadiusClass = (position: 'single' | 'top' | 'middle' | 'bottom') => {
  if (position === 'single') return 'rounded-[17px]';
  if (position === 'top') return 'rounded-t-[17px] rounded-b-[5px]';
  if (position === 'bottom') return 'rounded-t-[5px] rounded-b-[17px]';
  return 'rounded-[5px]';
};

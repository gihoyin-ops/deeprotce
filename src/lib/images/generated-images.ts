export type ResolvedGeneratedImage = {
  filePath: string;
  mimeType: string;
} | null;

export const saveGeneratedImage = async (base64: string, mimeType = 'image/png'): Promise<string> => {
  return `data:${mimeType};base64,${base64}`;
};

export const resolveGeneratedImage = (_fileName?: string): ResolvedGeneratedImage => {
  void _fileName;
  return null;
};

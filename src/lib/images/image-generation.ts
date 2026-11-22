export type GenerationMode = 'image';

const IMAGE_MODEL_PATTERNS = [
  /\bgpt-image\b/i,
  /\bdall-e\b/i,
  /\bimagen\b/i,
  /\bgemini\b[\w.-]*image/i,
  /\bimage\b[\w.-]*(preview|generate|generation)/i
];

export const IMAGE_GENERATION_STATUS_TEXTS = [
  'Composing the frame...',
  'Shaping light and form...',
  'Refining fine texture...',
  'Bringing it into focus...'
];

export interface ExtractedGeneratedImage {
  src: string;
  alt: string;
}

export interface ExtractedImageMarkdown {
  images: ExtractedGeneratedImage[];
  remainingText: string;
}

const GENERATED_IMAGE_MARKDOWN_PATTERN = /!\[([^\]\n]*)\]\(\s*((?:data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+)|(?:\/api\/chat\/image\/[^\s)]+)|(?:blob:[^\s)]+)|(?:https?:\/\/[^\s)]+))\s*\)/gi;

export const extractGeneratedImagesFromMarkdown = (content?: string): ExtractedImageMarkdown => {
  const source = String(content || '');
  if (!source) return { images: [], remainingText: '' };

  const images: ExtractedGeneratedImage[] = [];
  const outputChunks: string[] = [];
  const lines = source.split('\n');

  let plainLines: string[] = [];
  let fenceLines: string[] = [];
  let openFence: { char: string; length: number } | null = null;

  const flushPlainChunk = () => {
    if (plainLines.length === 0) return;
    const rawChunk = plainLines.join('\n');
    plainLines = [];
    const cleaned = rawChunk
      .replace(GENERATED_IMAGE_MARKDOWN_PATTERN, (_match, rawAlt: string, rawSrc: string) => {
        const normalizedSrc = rawSrc.startsWith('data:image/')
          ? rawSrc.replace(/\s+/g, '')
          : rawSrc.trim();
        if (normalizedSrc) {
          images.push({
            src: normalizedSrc,
            alt: (rawAlt || '').trim() || 'Generated image'
          });
        }
        return '';
      })
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (cleaned) {
      outputChunks.push(cleaned);
    }
  };

  for (const line of lines) {
    if (openFence) {
      fenceLines.push(line);
      const closingMatch = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
      if (
        closingMatch &&
        closingMatch[1][0] === openFence.char &&
        closingMatch[1].length >= openFence.length
      ) {
        outputChunks.push(fenceLines.join('\n'));
        fenceLines = [];
        openFence = null;
      }
      continue;
    }

    const openingMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (openingMatch) {
      flushPlainChunk();
      openFence = {
        char: openingMatch[1][0],
        length: openingMatch[1].length
      };
      fenceLines = [line];
      continue;
    }

    plainLines.push(line);
  }

  flushPlainChunk();
  if (fenceLines.length > 0) {
    outputChunks.push(fenceLines.join('\n'));
  }

  return {
    images,
    remainingText: outputChunks.join('\n\n').trim()
  };
};

export const isImageGenerationModel = (model?: string | null) => {
  const value = String(model || '').trim();
  return value ? IMAGE_MODEL_PATTERNS.some(pattern => pattern.test(value)) : false;
};

export const isImagenModel = (model?: string | null) => /\bimagen\b/i.test(String(model || ''));

export const isGeminiImageModel = (model?: string | null) => {
  const value = String(model || '');
  return /\bgemini\b/i.test(value) && /\bimage\b/i.test(value);
};

export const isOpenAIImageModel = (model?: string | null) => {
  const value = String(model || '');
  return /\bgpt-image\b/i.test(value) || /\bdall-e\b/i.test(value);
};

export const getGenerationMode = (model?: string | null): GenerationMode | undefined => (
  isImageGenerationModel(model) ? 'image' : undefined
);

export const stripGeneratedImageMarkdown = (content?: string) => (
  String(content || '')
    .replace(/!\[[^\]\n]*\]\(\s*data:image\/[a-z0-9.+-]+;base64,[^)]+\)/gi, '[generated image omitted]')
    .replace(/!\[[^\]\n]*\]\(\s*\/api\/chat\/image\/[a-f0-9-]+\.(?:png|jpg|jpeg|webp|gif)\s*\)/gi, '[generated image omitted]')
);

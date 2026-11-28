const SAFE_DOC_ELEMENTS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'a',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'span',
  'div',
];

const SAFE_DOC_ATTRS = ['href', 'title', 'class', 'colspan', 'rowspan'];

type NativeSanitizerElement = Element & {
  setHTML: (
    html: string,
    options?: { sanitizer?: { elements?: string[]; attributes?: string[] } }
  ) => void;
};

let domPurifyPromise: Promise<{ sanitize: (html: string, cfg: Record<string, unknown>) => string }> | null = null;

function loadDOMPurify() {
  domPurifyPromise ??= import('dompurify').then((mod) => mod.default ?? mod);
  return domPurifyPromise;
}

// Use the browser's native Sanitizer API first and lazy-load DOMPurify only where missing
export async function safeSetHTML(el: HTMLElement, html: string): Promise<void> {
  if ('setHTML' in Element.prototype) {
    (el as unknown as NativeSanitizerElement).setHTML(html, {
      sanitizer: {
        elements: SAFE_DOC_ELEMENTS,
        attributes: SAFE_DOC_ATTRS,
      },
    });
    return;
  }

  const DOMPurify = await loadDOMPurify();
  el.innerHTML = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...SAFE_DOC_ELEMENTS, '#text'],
    ALLOWED_ATTR: SAFE_DOC_ATTRS,
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: false,
  });
}

'use client';

import React from 'react';

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'name'> {
  size?: number | string;
  strokeWidth?: number | string;
}

export type IconName =
  | 'agent'
  | 'alert-circle'
  | 'archive'
  | 'arrow-left-to-line'
  | 'arrow-left'
  | 'arrow-right-to-line'
  | 'arrow-right'
  | 'arrow-up'
  | 'bar-chart-3'
  | 'bell-ring'
  | 'bell'
  | 'book-open'
  | 'bot'
  | 'brain-circuit'
  | 'brain'
  | 'check-circle-2'
  | 'check'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'code-2'
  | 'copy'
  | 'corner-down-left'
  | 'cpu'
  | 'database'
  | 'download'
  | 'edit-3'
  | 'edit'
  | 'ellipsis'
  | 'external-link'
  | 'file-down'
  | 'file-spreadsheet'
  | 'file-text'
  | 'file'
  | 'folder'
  | 'gauge'
  | 'globe'
  | 'hambuger'
  | 'help-circle'
  | 'image'
  | 'layers'
  | 'library'
  | 'lightbulb'
  | 'link'
  | 'loader-2'
  | 'maximize-2'
  | 'message-square'
  | 'mic'
  | 'monitor'
  | 'more-horizontal'
  | 'more-vertical'
  | 'mouse-pointer-2'
  | 'palette'
  | 'panel-bottom'
  | 'panel-left'
  | 'paperclip'
  | 'pen-line'
  | 'personalization'
  | 'pin'
  | 'play'
  | 'plus'
  | 'rectangle-horizontal'
  | 'rectangle-vertical'
  | 'refresh-cw'
  | 'scan'
  | 'search'
  | 'settings'
  | 'share-2'
  | 'shield-alert'
  | 'sliders-horizontal'
  | 'sparkles'
  | 'square-mouse-pointer'
  | 'square-pen'
  | 'square'
  | 'terminal'
  | 'thumbs-down'
  | 'thumbs-up'
  | 'trash-2'
  | 'user'
  | 'video'
  | 'volume-2'
  | 'x'
  | 'zap';

interface IconMeta {
  viewBox: string;
  fill: string;
  stroke: string;
  strokeWidth?: string;
  strokeLinecap: string;
  strokeLinejoin: string;
  inner: string;
}

export const ICONS_DATA: Record<IconName, IconMeta> = {
  'agent': {
    viewBox: '0 0 24 24',
    fill: '#000',
    stroke: '#D9D9D9',
    strokeWidth: '1.6',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<rect x=\"4\" y=\"7\" width=\"16\" height=\"13\" rx=\"4\" fill=\"#000\"/> <circle cx=\"9.5\" cy=\"12.5\" r=\"1.8\" fill=\"#D9D9D9\"/> <circle cx=\"14.5\" cy=\"12.5\" r=\"1.8\" fill=\"#D9D9D9\"/> <path d=\"M9.5 16h5\" stroke=\"#D9D9D9\" stroke-width=\"1.6\" stroke-linecap=\"round\"/> <path d=\"M12 7V4.5\" stroke=\"#000\" stroke-width=\"2\" stroke-linecap=\"round\"/> <circle cx=\"12\" cy=\"3.5\" r=\"1.5\" fill=\"#000\"/> <path d=\"M1.5 12.5h2.5M19.5 12.5h3\" stroke=\"#000\" stroke-width=\"2\" stroke-linecap=\"round\"/>"
  },
  'alert-circle': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 8v4\"/><path d=\"M12 16h.01\"/>"
  },
  'archive': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<rect x=\"2\" y=\"3\" width=\"20\" height=\"5\" rx=\"1\"/><path d=\"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8\"/><path d=\"M10 12h4\"/>"
  },
  'arrow-left-to-line': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M6 5v14\"/><path d=\"M21 12h-9\"/><path d=\"M15 8l-4 4 4 4\"/>"
  },
  'arrow-left': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M19 12H5\"/><path d=\"M12 19l-7-7 7-7\"/>"
  },
  'arrow-right-to-line': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M18 5v14\"/><path d=\"M3 12h9\"/><path d=\"M9 8l4 4-4 4\"/>"
  },
  'arrow-right': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M5 12h14\"/><path d=\"M12 5l7 7-7 7\"/>"
  },
  'arrow-up': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M12 19V5\"/><path d=\"M5 12l7-7 7 7\"/>"
  },
  'bar-chart-3': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M3 3v18h18\"/><path d=\"M8 17v-3\"/><path d=\"M13 17V5\"/><path d=\"M18 17V9\"/>"
  },
  'bell-ring': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\"/><path d=\"M10.3 21a1.9 1.9 0 0 0 3.4 0\"/><path d=\"M4 2C2.8 3.7 2 5.7 2 8\"/><path d=\"M22 8c0-2.3-.8-4.3-2-6\"/>"
  },
  'bell': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\"/><path d=\"M10.3 21a1.9 1.9 0 0 0 3.4 0\"/>"
  },
  'book-open': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z\"/><path d=\"M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z\"/>"
  },
  'bot': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<rect x=\"4\" y=\"8\" width=\"16\" height=\"12\" rx=\"3\"/><path d=\"M12 8V4\"/><circle cx=\"12\" cy=\"3\" r=\"1\"/><path d=\"M2 13h2\"/><path d=\"M20 13h2\"/><path d=\"M9 13v2\"/><path d=\"M15 13v2\"/>"
  },
  'brain-circuit': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M12 4.7C10.6 3.3 8.4 3.2 7.1 4.5 5.5 4.7 4.4 6.2 4.7 7.8 3.5 8.8 3.4 10.7 4.6 11.8 4.2 13.4 5.2 15 6.8 15.3 8.2 17.3 10.4 17.2 12 16.6\"/><path d=\"M12 4.7c1.4-1.4 3.6-1.5 4.9-.2 1.6.2 2.7 1.7 2.4 3.3 1.2 1 1.3 2.9.1 4 .4 1.6-.6 3.2-2.2 3.5-1.4 2-3.6 1.9-5.2 1.3\"/><circle cx=\"12\" cy=\"11\" r=\"2.2\"/><path d=\"M12 5.5V8.8\"/><path d=\"M7.6 11H9.8\"/><path d=\"M14.2 11h2.2\"/><path d=\"M12 13.2v4.3\"/>"
  },
  'brain': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M12 4.7C10.7 3.3 8.3 3.1 7 4.5 5.4 4.7 4.3 6.2 4.6 7.8 3.4 8.8 3.3 10.7 4.5 11.8 4.1 13.4 5.1 15 6.7 15.3 7.3 16.8 8.9 17.6 10.5 17.1 11 17 11.5 16.9 12 16.8Z\"/><path d=\"M12 4.7c1.3-1.4 3.7-1.6 5-.2 1.6.2 2.7 1.7 2.4 3.3 1.2 1 1.3 2.9.1 4 .4 1.6-.6 3.2-2.2 3.5-.6 1.5-2.2 2.3-3.8 1.8-.5-.1-1-.2-1.5-.3Z\"/><path d=\"M9.5 17.6c.5.9 1.4 1.4 2.5 1.4s2-.5 2.5-1.4\"/>"
  },
  'check-circle-2': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9 12l2 2 4-4\"/>"
  },
  'check': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M20 6L9 17l-5-5\"/>"
  },
  'chevron-down': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M6 9l6 6 6-6\"/>"
  },
  'chevron-left': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M15 18l-6-6 6-6\"/>"
  },
  'chevron-right': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M9 18l6-6-6-6\"/>"
  },
  'code-2': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M18 16l4-4-4-4\"/><path d=\"M6 8l-4 4 4 4\"/><path d=\"M14.5 4l-5 16\"/>"
  },
  'copy': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<rect x=\"8\" y=\"8\" width=\"13\" height=\"13\" rx=\"2\"/><path d=\"M16 3H5a2 2 0 0 0-2 2v11\"/>"
  },
  'corner-down-left': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M20 4v7a4 4 0 0 1-4 4H4\"/><path d=\"M9 10l-5 5 5 5\"/>"
  },
  'cpu': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\"/><rect x=\"9\" y=\"9\" width=\"6\" height=\"6\" rx=\"1\"/><path d=\"M9 2v2\"/><path d=\"M15 2v2\"/><path d=\"M9 20v2\"/><path d=\"M15 20v2\"/><path d=\"M2 9h2\"/><path d=\"M2 15h2\"/><path d=\"M20 9h2\"/><path d=\"M20 15h2\"/>"
  },
  'database': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\"/><path d=\"M3 5v14a9 3 0 0 0 18 0V5\"/><path d=\"M3 12a9 3 0 0 0 18 0\"/>"
  },
  'download': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><path d=\"M7 10l5 5 5-5\"/><path d=\"M12 15V3\"/>"
  },
  'edit-3': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z\"/>"
  },
  'edit': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z\"/>"
  },
  'ellipsis': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<circle cx=\"5\" cy=\"12\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"12\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"19\" cy=\"12\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/>"
  },
  'external-link': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M15 3h6v6\"/><path d=\"M10 14L21 3\"/><path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\"/>"
  },
  'file-down': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/><path d=\"M12 12v6\"/><path d=\"M9 15l3 3 3-3\"/>"
  },
  'file-spreadsheet': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/><path d=\"M8 13h2\"/><path d=\"M14 13h2\"/><path d=\"M8 17h2\"/><path d=\"M14 17h2\"/>"
  },
  'file-text': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/><path d=\"M8 13h8\"/><path d=\"M8 17h8\"/><path d=\"M8 9h2\"/>"
  },
  'file': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/>"
  },
  'folder': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z\"/>"
  },
  'gauge': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M12 14l4-4\"/><path d=\"M3.3 19a10 10 0 1 1 17.4 0\"/>"
  },
  'globe': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\"/><path d=\"M2 12h20\"/>"
  },
  'hambuger': {
    viewBox: '0 0 20 9',
    fill: '#8D7E7E',
    stroke: 'none',
    strokeWidth: undefined,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<rect width=\"20\" height=\"3\" rx=\"1.5\" fill=\"#8D7E7E\"/> <rect y=\"6\" width=\"15\" height=\"3\" rx=\"1.5\" fill=\"#8D7E7E\"/>"
  },
  'help-circle': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3\"/><path d=\"M12 17h.01\"/>"
  },
  'image': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><circle cx=\"9\" cy=\"9\" r=\"2\"/><path d=\"M21 15l-3.1-3.1a2 2 0 0 0-2.8 0L6 21\"/>"
  },
  'layers': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M12 2l8.5 4.7L12 11.4 3.5 6.7z\"/><path d=\"M3.5 12L12 16.7l8.5-4.7\"/><path d=\"M3.5 17.2L12 21.9l8.5-4.7\"/>"
  },
  'library': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M4 4v16\"/><path d=\"M8 8v12\"/><path d=\"M12 6v14\"/><path d=\"M16 6l4 14\"/>"
  },
  'lightbulb': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5a6 6 0 0 0-12 0c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5\"/><path d=\"M9 18h6\"/><path d=\"M10 22h4\"/>"
  },
  'link': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7\"/><path d=\"M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7\"/>"
  },
  'loader-2': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M21 12a9 9 0 1 1-9-9\"/>"
  },
  'maximize-2': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M15 3h6v6\"/><path d=\"M9 21H3v-6\"/><path d=\"M21 3l-7 7\"/><path d=\"M3 21l7-7\"/>"
  },
  'message-square': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/>"
  },
  'mic': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<rect x=\"9\" y=\"2\" width=\"6\" height=\"13\" rx=\"3\"/><path d=\"M19 10v2a7 7 0 0 1-14 0v-2\"/><path d=\"M12 19v3\"/>"
  },
  'monitor': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<rect x=\"2\" y=\"3\" width=\"20\" height=\"14\" rx=\"2\"/><path d=\"M8 21h8\"/><path d=\"M12 17v4\"/>"
  },
  'more-horizontal': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<circle cx=\"5\" cy=\"12\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"12\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"19\" cy=\"12\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/>"
  },
  'more-vertical': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<circle cx=\"12\" cy=\"5\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"12\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"19\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/>"
  },
  'mouse-pointer-2': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M5.5 3.5L19.5 9.8l-6.3 1.8-2.5 6z\"/>"
  },
  'palette': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10c0 1.7-1.3 3-3 3h-1.6a2.4 2.4 0 0 0-2.4 2.4c0 .5.2 1 .5 1.4.9 1.1.2 3.2-1.5 3.2z\"/><circle cx=\"7.5\" cy=\"11\" r=\"1.2\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"10.8\" cy=\"6.9\" r=\"1.2\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"15.2\" cy=\"8.1\" r=\"1.2\" fill=\"currentColor\" stroke=\"none\"/>"
  },
  'panel-bottom': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M3 15h18\"/>"
  },
  'panel-left': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M9 3v18\"/>"
  },
  'paperclip': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M21.4 11l-9.2 9.2a6 6 0 0 1-8.5-8.5l8.6-8.5A4 4 0 0 1 18 8.8l-8.6 8.6a2 2 0 0 1-2.8-2.8l8.5-8.5\"/>"
  },
  'pen-line': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M12 20h9\"/><path d=\"M17 3.5L20.5 7 8 19.5 4 20l.5-4z\"/>"
  },
  'personalization': {
    viewBox: '0 0 22 22',
    fill: 'none',
    stroke: '#000',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<circle cx=\"9\" cy=\"7.5\" r=\"4\" fill=\"none\" stroke=\"#000\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/> <path d=\"M2.5 19.5c.8-3.6 3.5-5.5 6.5-5.5s5.7 1.9 6.5 5.5\" fill=\"none\" stroke=\"#000\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/> <path d=\"M17.5 2v4M15.5 4h4M19.8 8.8v2.4M18.6 10h2.4\" fill=\"none\" stroke=\"#000\" stroke-width=\"1.6\" stroke-linecap=\"round\"/>"
  },
  'pin': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M9 3h6l-1 5 3 2.5V12a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 12v-1.5l3-2.5Z\"/><path d=\"M12 13.5V21\"/>"
  },
  'play': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M7 4.5l12.5 7.5L7 19.5z\"/>"
  },
  'plus': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M12 5v14\"/><path d=\"M5 12h14\"/>"
  },
  'rectangle-horizontal': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/>"
  },
  'rectangle-vertical': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<rect x=\"5\" y=\"2\" width=\"14\" height=\"20\" rx=\"2\"/>"
  },
  'refresh-cw': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M21 12a9 9 0 0 0-9-9 9.8 9.8 0 0 0-6.7 2.7L3 8\"/><path d=\"M3 3v5h5\"/><path d=\"M3 12a9 9 0 0 0 9 9 9.8 9.8 0 0 0 6.7-2.7L21 16\"/><path d=\"M21 21v-5h-5\"/>"
  },
  'scan': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M3 7V5a2 2 0 0 1 2-2h2\"/><path d=\"M17 3h2a2 2 0 0 1 2 2v2\"/><path d=\"M21 17v2a2 2 0 0 1-2 2h-2\"/><path d=\"M7 21H5a2 2 0 0 1-2-2v-2\"/>"
  },
  'search': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"M21 21l-4.3-4.3\"/>"
  },
  'settings': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M19.04 9.71 21.95 9.77 21.95 14.23 19.04 14.29 18.59 15.36 20.61 17.47 17.47 20.61 15.36 18.59 14.29 19.04 14.23 21.95 9.77 21.95 9.71 19.04 8.64 18.59 6.53 20.61 3.39 17.47 5.41 15.36 4.96 14.29 2.05 14.23 2.05 9.77 4.96 9.71 5.41 8.64 3.39 6.53 6.53 3.39 8.64 5.41 9.71 4.96 9.77 2.05 14.23 2.05 14.29 4.96 15.36 5.41 17.47 3.39 20.61 6.53 18.59 8.64Z\"/><circle cx=\"12\" cy=\"12\" r=\"3.2\"/>"
  },
  'share-2': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<circle cx=\"18\" cy=\"5\" r=\"3\"/><circle cx=\"6\" cy=\"12\" r=\"3\"/><circle cx=\"18\" cy=\"19\" r=\"3\"/><path d=\"M8.6 13.5l6.8 4\"/><path d=\"M15.4 6.5l-6.8 4\"/>"
  },
  'shield-alert': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z\"/><path d=\"M12 8v4\"/><path d=\"M12 16h.01\"/>"
  },
  'sliders-horizontal': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M21 4h-7\"/><path d=\"M10 4H3\"/><path d=\"M21 12h-9\"/><path d=\"M8 12H3\"/><path d=\"M21 20h-5\"/><path d=\"M12 20H3\"/><path d=\"M14 2v4\"/><path d=\"M8 10v4\"/><path d=\"M16 18v4\"/>"
  },
  'sparkles': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M12 3l-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z\"/><path d=\"M5 3v4\"/><path d=\"M3 5h4\"/><path d=\"M19 17v4\"/><path d=\"M17 19h4\"/>"
  },
  'square-mouse-pointer': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M9.5 9.5l6.5 2.5-2.8 1-1 3.2z\"/>"
  },
  'square-pen': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/><path d=\"M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z\"/>"
  },
  'square': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\"/>"
  },
  'terminal': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M4 17l6-6-6-6\"/><path d=\"M12 19h8\"/>"
  },
  'trash-2': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M3 6h18\"/><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\"/><path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/><path d=\"M10 11v6\"/><path d=\"M14 11v6\"/>"
  },
  'user': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"/><circle cx=\"12\" cy=\"7\" r=\"4\"/>"
  },
  'video': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M22 8l-6 4 6 4V8z\"/><rect x=\"2\" y=\"6\" width=\"14\" height=\"12\" rx=\"2\"/>"
  },
  'volume-2': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M11 5L6 9H2v6h4l5 4V5Z\"/><path d=\"M15.5 8.5a5 5 0 0 1 0 7\"/><path d=\"M19 5a9.5 9.5 0 0 1 0 14\"/>"
  },
  'x': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M18 6L6 18\"/><path d=\"M6 6l12 12\"/>"
  },
  'zap': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M13 2L3 14h9l-1 8 10-12h-9l1-8z\"/>"
  },
  'thumbs-up': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M7 10v12\"/><path d=\"M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z\"/>"
  },
  'thumbs-down': {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    inner: "<path d=\"M17 14V2\"/><path d=\"M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z\"/>"
  }
};

/**
 * Universal SVG Icon component sourced directly from @public/icons/.
 * Supports currentColor, custom size, strokeWidth, and className.
 */
export function Icon({
  name,
  size,
  strokeWidth,
  className = '',
  fill,
  stroke,
  ...props
}: IconProps & { name: IconName }) {
  const meta = ICONS_DATA[name];
  if (!meta) return null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={meta.viewBox}
      fill={fill ?? meta.fill}
      stroke={stroke ?? meta.stroke}
      strokeWidth={strokeWidth ?? meta.strokeWidth}
      strokeLinecap={meta.strokeLinecap as 'round' | 'butt' | 'square'}
      strokeLinejoin={meta.strokeLinejoin as 'round' | 'bevel' | 'miter'}
      width={size ?? undefined}
      height={size ?? undefined}
      className={className}
      aria-hidden="true"
      {...props}
      dangerouslySetInnerHTML={{ __html: meta.inner }}
    />
  );
}

export default Icon;

// Named Icon exports mapped from @public/icons/
export const Agent: React.FC<IconProps> = (props) => <Icon name="agent" {...props} />;
export const AlertCircle: React.FC<IconProps> = (props) => <Icon name="alert-circle" {...props} />;
export const Archive: React.FC<IconProps> = (props) => <Icon name="archive" {...props} />;
export const ArrowLeftToLine: React.FC<IconProps> = (props) => <Icon name="arrow-left-to-line" {...props} />;
export const ArrowLeft: React.FC<IconProps> = (props) => <Icon name="arrow-left" {...props} />;
export const ArrowRightToLine: React.FC<IconProps> = (props) => <Icon name="arrow-right-to-line" {...props} />;
export const ArrowRight: React.FC<IconProps> = (props) => <Icon name="arrow-right" {...props} />;
export const ArrowUp: React.FC<IconProps> = (props) => <Icon name="arrow-up" {...props} />;
export const BarChart3: React.FC<IconProps> = (props) => <Icon name="bar-chart-3" {...props} />;
export const BellRing: React.FC<IconProps> = (props) => <Icon name="bell-ring" {...props} />;
export const Bell: React.FC<IconProps> = (props) => <Icon name="bell" {...props} />;
export const BookOpen: React.FC<IconProps> = (props) => <Icon name="book-open" {...props} />;
export const Bot: React.FC<IconProps> = (props) => <Icon name="bot" {...props} />;
export const BrainCircuit: React.FC<IconProps> = (props) => <Icon name="brain-circuit" {...props} />;
export const Brain: React.FC<IconProps> = (props) => <Icon name="brain" {...props} />;
export const CheckCircle2: React.FC<IconProps> = (props) => <Icon name="check-circle-2" {...props} />;
export const Check: React.FC<IconProps> = (props) => <Icon name="check" {...props} />;
export const ChevronDown: React.FC<IconProps> = (props) => <Icon name="chevron-down" {...props} />;
export const ChevronLeft: React.FC<IconProps> = (props) => <Icon name="chevron-left" {...props} />;
export const ChevronRight: React.FC<IconProps> = (props) => <Icon name="chevron-right" {...props} />;
export const Code2: React.FC<IconProps> = (props) => <Icon name="code-2" {...props} />;
export const Copy: React.FC<IconProps> = (props) => <Icon name="copy" {...props} />;
export const CornerDownLeft: React.FC<IconProps> = (props) => <Icon name="corner-down-left" {...props} />;
export const Cpu: React.FC<IconProps> = (props) => <Icon name="cpu" {...props} />;
export const Database: React.FC<IconProps> = (props) => <Icon name="database" {...props} />;
export const Download: React.FC<IconProps> = (props) => <Icon name="download" {...props} />;
export const Edit3: React.FC<IconProps> = (props) => <Icon name="edit-3" {...props} />;
export const Edit: React.FC<IconProps> = (props) => <Icon name="edit" {...props} />;
export const Ellipsis: React.FC<IconProps> = (props) => <Icon name="ellipsis" {...props} />;
export const ExternalLink: React.FC<IconProps> = (props) => <Icon name="external-link" {...props} />;
export const FileDown: React.FC<IconProps> = (props) => <Icon name="file-down" {...props} />;
export const FileSpreadsheet: React.FC<IconProps> = (props) => <Icon name="file-spreadsheet" {...props} />;
export const FileText: React.FC<IconProps> = (props) => <Icon name="file-text" {...props} />;
export const File: React.FC<IconProps> = (props) => <Icon name="file" {...props} />;
export const Folder: React.FC<IconProps> = (props) => <Icon name="folder" {...props} />;
export const Gauge: React.FC<IconProps> = (props) => <Icon name="gauge" {...props} />;
export const Globe: React.FC<IconProps> = (props) => <Icon name="globe" {...props} />;
export const Hambuger: React.FC<IconProps> = (props) => <Icon name="hambuger" {...props} />;
export const HelpCircle: React.FC<IconProps> = (props) => <Icon name="help-circle" {...props} />;
export const Image: React.FC<IconProps> = (props) => <Icon name="image" {...props} />;
export const Layers: React.FC<IconProps> = (props) => <Icon name="layers" {...props} />;
export const Library: React.FC<IconProps> = (props) => <Icon name="library" {...props} />;
export const Lightbulb: React.FC<IconProps> = (props) => <Icon name="lightbulb" {...props} />;
export const Link: React.FC<IconProps> = (props) => <Icon name="link" {...props} />;
export const Loader2: React.FC<IconProps> = (props) => <Icon name="loader-2" {...props} />;
export const Maximize2: React.FC<IconProps> = (props) => <Icon name="maximize-2" {...props} />;
export const MessageSquare: React.FC<IconProps> = (props) => <Icon name="message-square" {...props} />;
export const Mic: React.FC<IconProps> = (props) => <Icon name="mic" {...props} />;
export const Monitor: React.FC<IconProps> = (props) => <Icon name="monitor" {...props} />;
export const MoreHorizontal: React.FC<IconProps> = (props) => <Icon name="more-horizontal" {...props} />;
export const MoreVertical: React.FC<IconProps> = (props) => <Icon name="more-vertical" {...props} />;
export const MousePointer2: React.FC<IconProps> = (props) => <Icon name="mouse-pointer-2" {...props} />;
export const Palette: React.FC<IconProps> = (props) => <Icon name="palette" {...props} />;
export const PanelBottom: React.FC<IconProps> = (props) => <Icon name="panel-bottom" {...props} />;
export const PanelLeft: React.FC<IconProps> = (props) => <Icon name="panel-left" {...props} />;
export const Paperclip: React.FC<IconProps> = (props) => <Icon name="paperclip" {...props} />;
export const PenLine: React.FC<IconProps> = (props) => <Icon name="pen-line" {...props} />;
export const Personalization: React.FC<IconProps> = (props) => <Icon name="personalization" {...props} />;
export const Pin: React.FC<IconProps> = (props) => <Icon name="pin" {...props} />;
export const Play: React.FC<IconProps> = (props) => <Icon name="play" {...props} />;
export const Plus: React.FC<IconProps> = (props) => <Icon name="plus" {...props} />;
export const RectangleHorizontal: React.FC<IconProps> = (props) => <Icon name="rectangle-horizontal" {...props} />;
export const RectangleVertical: React.FC<IconProps> = (props) => <Icon name="rectangle-vertical" {...props} />;
export const RefreshCw: React.FC<IconProps> = (props) => <Icon name="refresh-cw" {...props} />;
export const Scan: React.FC<IconProps> = (props) => <Icon name="scan" {...props} />;
export const Search: React.FC<IconProps> = (props) => <Icon name="search" {...props} />;
export const Settings: React.FC<IconProps> = (props) => <Icon name="settings" {...props} />;
export const Share2: React.FC<IconProps> = (props) => <Icon name="share-2" {...props} />;
export const ShieldAlert: React.FC<IconProps> = (props) => <Icon name="shield-alert" {...props} />;
export const SlidersHorizontal: React.FC<IconProps> = (props) => <Icon name="sliders-horizontal" {...props} />;
export const Sparkles: React.FC<IconProps> = (props) => <Icon name="sparkles" {...props} />;
export const SquareMousePointer: React.FC<IconProps> = (props) => <Icon name="square-mouse-pointer" {...props} />;
export const SquarePen: React.FC<IconProps> = (props) => <Icon name="square-pen" {...props} />;
export const Square: React.FC<IconProps> = (props) => <Icon name="square" {...props} />;
export const Terminal: React.FC<IconProps> = (props) => <Icon name="terminal" {...props} />;
export const ThumbsDown: React.FC<IconProps> = (props) => <Icon name="thumbs-down" {...props} />;
export const ThumbsUp: React.FC<IconProps> = (props) => <Icon name="thumbs-up" {...props} />;
export const Trash2: React.FC<IconProps> = (props) => <Icon name="trash-2" {...props} />;
export const User: React.FC<IconProps> = (props) => <Icon name="user" {...props} />;
export const Video: React.FC<IconProps> = (props) => <Icon name="video" {...props} />;
export const Volume2: React.FC<IconProps> = (props) => <Icon name="volume-2" {...props} />;
export const X: React.FC<IconProps> = (props) => <Icon name="x" {...props} />;
export const Zap: React.FC<IconProps> = (props) => <Icon name="zap" {...props} />;
export const LikeIcon = ThumbsUp;
export const DislikeIcon = ThumbsDown;

// Convenient aliases for common component naming
export const SettingsIcon = Settings;
export const ImageIcon = Image;
export const LinkIcon = Link;
export const Hamburger = Hambuger;
export const HamburgerIcon = Hambuger;

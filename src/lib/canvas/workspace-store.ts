import type {
  CanvasOp,
  CanvasStreamingUpdate,
  CanvasWorkspaceSnapshot,
} from './types';

export type CanvasBusEvent =
  | { type: 'stream_delta'; delta: CanvasStreamingUpdate }
  | { type: 'op'; op: CanvasOp }
  | { type: 'stream_end' }
  | { type: 'focus_file'; path: string };

type CanvasEventListener = (event: CanvasBusEvent) => void;

const workspaceSnapshots = new Map<string, CanvasWorkspaceSnapshot>();
const listeners = new Map<string, Set<CanvasEventListener>>();

export function registerWorkspaceSnapshot(
  chatId: string,
  snapshot: CanvasWorkspaceSnapshot
): void {
  workspaceSnapshots.set(chatId, snapshot);
}

export function getWorkspaceSnapshotForChat(
  chatId: string
): CanvasWorkspaceSnapshot | null {
  return workspaceSnapshots.get(chatId) || null;
}

function dispatch(chatId: string, event: CanvasBusEvent): void {
  listeners.get(chatId)?.forEach((fn) => fn(event));
}

export function emitCanvasStreamDelta(
  chatId: string,
  delta: CanvasStreamingUpdate
): void {
  dispatch(chatId, { type: 'stream_delta', delta });
}

export function emitCanvasOp(chatId: string, op: CanvasOp): void {
  dispatch(chatId, { type: 'op', op });
}

export function emitCanvasStreamEnd(chatId: string): void {
  dispatch(chatId, { type: 'stream_end' });
}

export function emitFocusCanvasFile(chatId: string, path: string): void {
  dispatch(chatId, { type: 'focus_file', path });
}

export function subscribeCanvasEvents(
  chatId: string,
  listener: CanvasEventListener
): () => void {
  const set = listeners.get(chatId) || new Set<CanvasEventListener>();
  set.add(listener);
  listeners.set(chatId, set);

  return () => {
    const current = listeners.get(chatId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(chatId);
  };
}

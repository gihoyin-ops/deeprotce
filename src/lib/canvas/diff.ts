export type DiffLineType = 'context' | 'add' | 'remove';

export interface DiffLine {
  type: DiffLineType;
  oldLine: number | null;
  newLine: number | null;
  text: string;
}

export interface DiffHunk {
  id: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  addedCount: number;
  removedCount: number;
  lines: DiffLine[];
}

export interface DiffStats {
  added: number;
  removed: number;
}

function splitLines(text: string): string[] {
  if (!text) return [];
  return text.replace(/\r\n/g, '\n').split('\n');
}

function lcsDiffSlice(a: string[], b: string[]): Array<{ type: DiffLineType; text: string }> {
  const m = a.length;
  const n = b.length;

  // Bail out of DP on huge inputs so the main thread doesn't choke
  if (m * n > 900_000) {
    return [
      ...a.map((text) => ({ type: 'remove' as const, text })),
      ...b.map((text) => ({ type: 'add' as const, text })),
    ];
  }

  const dp = new Uint32Array((m + 1) * (n + 1));
  const stride = n + 1;

  for (let i = m - 1; i >= 0; i -= 1) {
    const row = i * stride;
    const nextRow = (i + 1) * stride;
    for (let j = n - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        dp[row + j] = dp[nextRow + j + 1] + 1;
      } else {
        const down = dp[nextRow + j];
        const right = dp[row + j + 1];
        dp[row + j] = down >= right ? down : right;
      }
    }
  }

  const ops: Array<{ type: DiffLineType; text: string }> = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ops.push({ type: 'context', text: a[i] });
      i += 1;
      j += 1;
    } else if (dp[(i + 1) * stride + j] >= dp[i * stride + j + 1]) {
      ops.push({ type: 'remove', text: a[i] });
      i += 1;
    } else {
      ops.push({ type: 'add', text: b[j] });
      j += 1;
    }
  }
  while (i < m) {
    ops.push({ type: 'remove', text: a[i] });
    i += 1;
  }
  while (j < n) {
    ops.push({ type: 'add', text: b[j] });
    j += 1;
  }
  return ops;
}

export function computeLineDiff(baseText: string, proposedText: string): DiffLine[] {
  const a = splitLines(baseText);
  const b = splitLines(proposedText);

  // Trim shared head and tail first so small edits stay instant
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const middleOps = lcsDiffSlice(
    a.slice(prefix, a.length - suffix),
    b.slice(prefix, b.length - suffix)
  );

  const lines: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (let i = 0; i < prefix; i += 1) {
    lines.push({ type: 'context', oldLine, newLine, text: a[i] });
    oldLine += 1;
    newLine += 1;
  }

  for (const op of middleOps) {
    if (op.type === 'context') {
      lines.push({ type: 'context', oldLine, newLine, text: op.text });
      oldLine += 1;
      newLine += 1;
    } else if (op.type === 'remove') {
      lines.push({ type: 'remove', oldLine, newLine: null, text: op.text });
      oldLine += 1;
    } else {
      lines.push({ type: 'add', oldLine: null, newLine, text: op.text });
      newLine += 1;
    }
  }

  for (let i = a.length - suffix; i < a.length; i += 1) {
    lines.push({ type: 'context', oldLine, newLine, text: a[i] });
    oldLine += 1;
    newLine += 1;
  }

  return lines;
}

export function countDiffStats(baseText: string, proposedText: string): DiffStats {
  const lines = computeLineDiff(baseText, proposedText);
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.type === 'add') added += 1;
    else if (line.type === 'remove') removed += 1;
  }
  return { added, removed };
}

interface IndexedHunkRange {
  id: string;
  startIndex: number;
  endIndex: number;
}

function getHunkRanges(lines: DiffLine[], contextLines: number): IndexedHunkRange[] {
  const changeIndices: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].type !== 'context') changeIndices.push(i);
  }
  if (changeIndices.length === 0) return [];

  const ranges: IndexedHunkRange[] = [];
  let start = Math.max(0, changeIndices[0] - contextLines);
  let end = Math.min(lines.length - 1, changeIndices[0] + contextLines);

  for (let i = 1; i < changeIndices.length; i += 1) {
    const idx = changeIndices[i];
    const nextStart = Math.max(0, idx - contextLines);
    const nextEnd = Math.min(lines.length - 1, idx + contextLines);
    if (nextStart <= end + 1) {
      end = nextEnd;
    } else {
      ranges.push({ id: `hunk-${ranges.length}`, startIndex: start, endIndex: end });
      start = nextStart;
      end = nextEnd;
    }
  }
  ranges.push({ id: `hunk-${ranges.length}`, startIndex: start, endIndex: end });
  return ranges;
}

export function buildDiffHunks(
  baseText: string,
  proposedText: string,
  contextLines = 3
): DiffHunk[] {
  const lines = computeLineDiff(baseText, proposedText);
  const ranges = getHunkRanges(lines, contextLines);

  return ranges.map((range) => {
    const slice = lines.slice(range.startIndex, range.endIndex + 1);
    let oldStart = 1;
    let newStart = 1;
    let foundOld = false;
    let foundNew = false;
    let oldLines = 0;
    let newLines = 0;
    let addedCount = 0;
    let removedCount = 0;

    for (const line of slice) {
      if (!foundOld && line.oldLine !== null) {
        oldStart = line.oldLine;
        foundOld = true;
      }
      if (!foundNew && line.newLine !== null) {
        newStart = line.newLine;
        foundNew = true;
      }
      if (line.type !== 'add') oldLines += 1;
      if (line.type !== 'remove') newLines += 1;
      if (line.type === 'add') addedCount += 1;
      if (line.type === 'remove') removedCount += 1;
    }

    return {
      id: range.id,
      oldStart,
      oldLines,
      newStart,
      newLines,
      addedCount,
      removedCount,
      lines: slice,
    };
  });
}

export function resolveHunkDecision(
  baseText: string,
  proposedText: string,
  hunkId: string,
  decision: 'accept' | 'reject',
  contextLines = 3
): {
  nextBase: string;
  nextProposed: string;
  remainingHunks: DiffHunk[];
} {
  const lines = computeLineDiff(baseText, proposedText);
  const ranges = getHunkRanges(lines, contextLines);
  const target = ranges.find((r) => r.id === hunkId);

  if (!target) {
    return {
      nextBase: baseText,
      nextProposed: proposedText,
      remainingHunks: buildDiffHunks(baseText, proposedText, contextLines),
    };
  }

  const nextBaseLines: string[] = [];
  const nextProposedLines: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const inTarget = i >= target.startIndex && i <= target.endIndex;

    if (line.type === 'context') {
      nextBaseLines.push(line.text);
      nextProposedLines.push(line.text);
      continue;
    }

    if (!inTarget) {
      if (line.type === 'remove') nextBaseLines.push(line.text);
      if (line.type === 'add') nextProposedLines.push(line.text);
      continue;
    }

    // Apply accepted/rejected changes only inside the targeted hunk
    if (decision === 'accept') {
      if (line.type === 'add') {
        nextBaseLines.push(line.text);
        nextProposedLines.push(line.text);
      }
    } else {
      if (line.type === 'remove') {
        nextBaseLines.push(line.text);
        nextProposedLines.push(line.text);
      }
    }
  }

  const nextBase = nextBaseLines.join('\n');
  const nextProposed = nextProposedLines.join('\n');
  return {
    nextBase,
    nextProposed,
    remainingHunks: buildDiffHunks(nextBase, nextProposed, contextLines),
  };
}

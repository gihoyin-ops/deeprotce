type CellScalar = string | number | boolean;

type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: string }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'comma' }
  | { type: 'colon' };

export function columnIndexToLabel(index: number): string {
  let n = index;
  let label = '';
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

export function columnLabelToIndex(label: string): number {
  const upper = label.toUpperCase();
  let result = 0;
  for (let i = 0; i < upper.length; i += 1) {
    result = result * 26 + (upper.charCodeAt(i) - 64);
  }
  return result - 1;
}

export function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = /^\$?([A-Za-z]{1,3})\$?(\d{1,5})$/.exec(ref.trim());
  if (!match) return null;
  const col = columnLabelToIndex(match[1]);
  const row = Number.parseInt(match[2], 10) - 1;
  if (col < 0 || row < 0) return null;
  return { row, col };
}

function tokenizeFormula(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i += 1;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma' });
      i += 1;
      continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'colon' });
      i += 1;
      continue;
    }
    if (ch === '"') {
      let str = '';
      i += 1;
      while (i < input.length) {
        if (input[i] === '"' && input[i + 1] === '"') {
          str += '"';
          i += 2;
          continue;
        }
        if (input[i] === '"') {
          i += 1;
          break;
        }
        str += input[i];
        i += 1;
      }
      tokens.push({ type: 'string', value: str });
      continue;
    }
    const twoChar = input.slice(i, i + 2);
    if (twoChar === '<=' || twoChar === '>=' || twoChar === '<>') {
      tokens.push({ type: 'op', value: twoChar });
      i += 2;
      continue;
    }
    if ('+-*/^=<>'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(input[i + 1] || ''))) {
      let numStr = '';
      while (i < input.length && /[\d.]/.test(input[i])) {
        numStr += input[i];
        i += 1;
      }
      const parsed = Number(numStr);
      if (Number.isNaN(parsed)) throw new Error('#VALUE!');
      tokens.push({ type: 'number', value: parsed });
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let ident = '';
      while (i < input.length && /[A-Za-z0-9_$]/.test(input[i])) {
        ident += input[i];
        i += 1;
      }
      tokens.push({ type: 'ident', value: ident });
      continue;
    }
    throw new Error('#ERROR!');
  }
  return tokens;
}

type EvalArg = CellScalar | CellScalar[];

function toNumber(val: CellScalar): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val === 'boolean') return val ? 1 : 0;
  const trimmed = val.trim();
  if (!trimmed) return 0;
  const n = Number(trimmed.replace(/,/g, ''));
  if (Number.isNaN(n)) throw new Error('#VALUE!');
  return n;
}

function toNumbersList(args: EvalArg[]): number[] {
  const nums: number[] = [];
  for (const arg of args) {
    const items = Array.isArray(arg) ? arg : [arg];
    for (const item of items) {
      if (typeof item === 'number' && Number.isFinite(item)) {
        nums.push(item);
      } else if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed) {
          const n = Number(trimmed.replace(/,/g, ''));
          if (Number.isFinite(n)) nums.push(n);
        }
      } else if (typeof item === 'boolean') {
        nums.push(item ? 1 : 0);
      }
    }
  }
  return nums;
}

function callFormulaFunction(name: string, args: EvalArg[]): CellScalar {
  const fn = name.toUpperCase();
  const flat = args.flatMap((a) => (Array.isArray(a) ? a : [a]));

  switch (fn) {
    case 'SUM': {
      return toNumbersList(args).reduce((acc, n) => acc + n, 0);
    }
    case 'AVERAGE':
    case 'AVG': {
      const nums = toNumbersList(args);
      if (nums.length === 0) return 0;
      return nums.reduce((acc, n) => acc + n, 0) / nums.length;
    }
    case 'MIN': {
      const nums = toNumbersList(args);
      return nums.length > 0 ? Math.min(...nums) : 0;
    }
    case 'MAX': {
      const nums = toNumbersList(args);
      return nums.length > 0 ? Math.max(...nums) : 0;
    }
    case 'COUNT': {
      return toNumbersList(args).length;
    }
    case 'COUNTA': {
      return flat.filter((v) => String(v ?? '').trim() !== '').length;
    }
    case 'MEDIAN': {
      const nums = toNumbersList(args).sort((a, b) => a - b);
      if (nums.length === 0) return 0;
      const mid = Math.floor(nums.length / 2);
      return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
    }
    case 'IF': {
      const cond = flat[0];
      const truthy = typeof cond === 'boolean' ? cond : Number(cond) !== 0 && cond !== '';
      return truthy ? (flat[1] ?? '') : (flat[2] ?? '');
    }
    case 'ROUND': {
      const n = toNumber(flat[0] ?? 0);
      const digits = Math.trunc(toNumber(flat[1] ?? 0));
      const factor = 10 ** digits;
      return Math.round(n * factor) / factor;
    }
    case 'ABS': {
      return Math.abs(toNumber(flat[0] ?? 0));
    }
    case 'CONCAT': {
      return flat.map((v) => String(v ?? '')).join('');
    }
    case 'LEN': {
      return String(flat[0] ?? '').length;
    }
    case 'UPPER': {
      return String(flat[0] ?? '').toUpperCase();
    }
    case 'LOWER': {
      return String(flat[0] ?? '').toLowerCase();
    }
    default:
      throw new Error('#NAME?');
  }
}

export function evaluateSheet(rows: string[][]): string[][] {
  const rowCount = rows.length;
  const colCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const cache = new Map<string, CellScalar>();
  const visiting = new Set<string>();

  const getRawCell = (r: number, c: number): string => {
    if (r < 0 || c < 0 || r >= rowCount) return '';
    return rows[r]?.[c] ?? '';
  };

  const evaluateCell = (r: number, c: number): CellScalar => {
    const key = `${r}:${c}`;
    if (cache.has(key)) return cache.get(key)!;
    if (visiting.has(key)) throw new Error('#REF!');

    const raw = getRawCell(r, c);
    if (!raw.startsWith('=')) {
      const trimmed = raw.trim();
      if (trimmed !== '' && /^-?\d+(\.\d+)?$/.test(trimmed)) {
        const num = Number(trimmed);
        cache.set(key, num);
        return num;
      }
      cache.set(key, raw);
      return raw;
    }

    visiting.add(key);
    try {
      const tokens = tokenizeFormula(raw.slice(1));
      let pos = 0;

      const peek = () => tokens[pos];
      const consume = () => {
        const tok = tokens[pos];
        pos += 1;
        return tok;
      };

      const expandRange = (startRef: string, endRef: string): CellScalar[] => {
        const start = parseCellRef(startRef);
        const end = parseCellRef(endRef);
        if (!start || !end) throw new Error('#REF!');
        const rMin = Math.min(start.row, end.row);
        const rMax = Math.max(start.row, end.row);
        const cMin = Math.min(start.col, end.col);
        const cMax = Math.max(start.col, end.col);
        const out: CellScalar[] = [];
        for (let rr = rMin; rr <= rMax; rr += 1) {
          for (let cc = cMin; cc <= cMax; cc += 1) {
            out.push(evaluateCell(rr, cc));
          }
        }
        return out;
      };

      const parseComparison = (): CellScalar => {
        let left = parseAdditive();
        while (
          peek()?.type === 'op' &&
          ['=', '<>', '<', '<=', '>', '>='].includes((peek() as { type: 'op'; value: string }).value)
        ) {
          const op = (consume() as { type: 'op'; value: string }).value;
          const right = parseAdditive();
          if (op === '=') left = left === right;
          else if (op === '<>') left = left !== right;
          else {
            const ln = toNumber(left);
            const rn = toNumber(right);
            if (op === '<') left = ln < rn;
            else if (op === '<=') left = ln <= rn;
            else if (op === '>') left = ln > rn;
            else if (op === '>=') left = ln >= rn;
          }
        }
        return left;
      };

      const parseAdditive = (): CellScalar => {
        let left = parseMultiplicative();
        while (
          peek()?.type === 'op' &&
          ((peek() as { type: 'op'; value: string }).value === '+' ||
            (peek() as { type: 'op'; value: string }).value === '-')
        ) {
          const op = (consume() as { type: 'op'; value: string }).value;
          const right = parseMultiplicative();
          const ln = toNumber(left);
          const rn = toNumber(right);
          left = op === '+' ? ln + rn : ln - rn;
        }
        return left;
      };

      const parseMultiplicative = (): CellScalar => {
        let left = parsePower();
        while (
          peek()?.type === 'op' &&
          ((peek() as { type: 'op'; value: string }).value === '*' ||
            (peek() as { type: 'op'; value: string }).value === '/')
        ) {
          const op = (consume() as { type: 'op'; value: string }).value;
          const right = parsePower();
          const ln = toNumber(left);
          const rn = toNumber(right);
          if (op === '/') {
            if (rn === 0) throw new Error('#DIV/0!');
            left = ln / rn;
          } else {
            left = ln * rn;
          }
        }
        return left;
      };

      const parsePower = (): CellScalar => {
        const base = parseUnary();
        if (peek()?.type === 'op' && (peek() as { type: 'op'; value: string }).value === '^') {
          consume();
          const exp = parsePower();
          return toNumber(base) ** toNumber(exp);
        }
        return base;
      };

      const parseUnary = (): CellScalar => {
        if (peek()?.type === 'op' && (peek() as { type: 'op'; value: string }).value === '-') {
          consume();
          return -toNumber(parseUnary());
        }
        if (peek()?.type === 'op' && (peek() as { type: 'op'; value: string }).value === '+') {
          consume();
          return toNumber(parseUnary());
        }
        return parsePrimary();
      };

      const parseArg = (): EvalArg => {
        const first = peek();
        const second = tokens[pos + 1];
        if (first?.type === 'ident' && second?.type === 'colon') {
          const startIdent = (consume() as { type: 'ident'; value: string }).value;
          consume(); // ':'
          const endTok = consume();
          if (endTok?.type !== 'ident') throw new Error('#REF!');
          return expandRange(startIdent, endTok.value);
        }
        return parseComparison();
      };

      const parsePrimary = (): CellScalar => {
        const tok = consume();
        if (!tok) throw new Error('#ERROR!');

        if (tok.type === 'number') return tok.value;
        if (tok.type === 'string') return tok.value;

        if (tok.type === 'paren' && tok.value === '(') {
          const val = parseComparison();
          const close = consume();
          if (!close || close.type !== 'paren' || close.value !== ')') throw new Error('#ERROR!');
          return val;
        }

        if (tok.type === 'ident') {
          const upper = tok.value.toUpperCase();
          if (upper === 'TRUE') return true;
          if (upper === 'FALSE') return false;

          if (peek()?.type === 'paren' && (peek() as { type: 'paren'; value: '(' | ')' }).value === '(') {
            consume(); // '('
            const args: EvalArg[] = [];
            if (!(peek()?.type === 'paren' && (peek() as { type: 'paren'; value: '(' | ')' }).value === ')')) {
              while (true) {
                args.push(parseArg());
                if (peek()?.type === 'comma') {
                  consume();
                  continue;
                }
                break;
              }
            }
            const close = consume();
            if (!close || close.type !== 'paren' || close.value !== ')') throw new Error('#ERROR!');
            return callFormulaFunction(tok.value, args);
          }

          const ref = parseCellRef(tok.value);
          if (ref) return evaluateCell(ref.row, ref.col);
          throw new Error('#NAME?');
        }

        throw new Error('#ERROR!');
      };

      const value = tokens.length > 0 ? parseComparison() : '';
      cache.set(key, value);
      return value;
    } catch (err) {
      const errCode = err instanceof Error && err.message.startsWith('#') ? err.message : '#ERR';
      cache.set(key, errCode);
      return errCode;
    } finally {
      visiting.delete(key);
    }
  };

  const out: string[][] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const rowOut: string[] = [];
    for (let c = 0; c < colCount; c += 1) {
      const raw = getRawCell(r, c);
      if (!raw.startsWith('=')) {
        rowOut.push(raw);
        continue;
      }
      const val = evaluateCell(r, c);
      if (typeof val === 'number') {
        rowOut.push(Number.isInteger(val) ? String(val) : String(Number(val.toFixed(4))));
      } else {
        rowOut.push(String(val));
      }
    }
    out.push(rowOut);
  }
  return out;
}

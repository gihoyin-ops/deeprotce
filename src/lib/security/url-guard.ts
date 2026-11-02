import dns from 'node:dns';
import net from 'node:net';

const deny = (): never => {
  throw new Error('unsafe_egress_url');
};

const toV4Int = (ip: string): number | null => {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value;
};

const inV4Cidr = (value: number, network: number, prefix: number): boolean => {
  const mask = (~0 << (32 - prefix)) >>> 0;
  return (value & mask) === (network & mask);
};

const BLOCKED_V4: [number, number][] = [
  [0x7f000000, 8],
  [0x0a000000, 8],
  [0xac100000, 12],
  [0xc0a80000, 16],
  [0xa9fe0000, 16],
  [0x00000000, 8],
  [0x64400000, 10]
];

const isBlockedV4Literal = (ip: string): boolean => {
  const value = toV4Int(ip);
  if (value === null) return false;
  return BLOCKED_V4.some(([network, prefix]) => inV4Cidr(value, network, prefix));
};

const parseV6Group = (group: string): number[] | null => {
  if (group === '') return null;
  if (group.includes('.')) {
    const v4 = toV4Int(group);
    if (v4 === null) return null;
    return [(v4 >>> 16) & 0xffff, v4 & 0xffff];
  }
  if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
  return [Number.parseInt(group, 16)];
};

const toV6Words = (host: string): number[] | null => {
  const bare = host.split('%')[0];
  if (bare === '' || !bare.includes(':')) return null;

  const ellipsis = bare.indexOf('::');
  const hasEllipsis = ellipsis !== -1;
  const leftStr = hasEllipsis ? bare.slice(0, ellipsis) : bare;
  const rightStr = hasEllipsis ? bare.slice(ellipsis + 2) : '';

  const parseSide = (side: string): number[] | null => {
    if (side === '') return [];
    const words: number[] = [];
    for (const group of side.split(':')) {
      const parsed = parseV6Group(group);
      if (parsed === null) return null;
      words.push(...parsed);
    }
    return words;
  };

  const left = parseSide(leftStr);
  if (left === null) return null;
  const right = parseSide(rightStr);
  if (right === null) return null;

  if (!hasEllipsis) return left.length === 8 ? left : null;
  if (left.length + right.length >= 8) return null;
  const fill = Array<number>(8 - left.length - right.length).fill(0);
  return [...left, ...fill, ...right];
};

const isBlockedV6Literal = (ip: string): boolean => {
  const words = toV6Words(ip);
  if (words === null) return true;
  if (words.slice(0, 7).every((w) => w === 0) && words[7] === 1) return true;
  if ((words[0] & 0xfe00) === 0xfc00) return true;
  if ((words[0] & 0xffc0) === 0xfe80) return true;
  if (words.slice(0, 5).every((w) => w === 0) && words[5] === 0xffff) {
    const v4 =
      `${(words[6] >>> 8) & 0xff}.${words[6] & 0xff}.` +
      `${(words[7] >>> 8) & 0xff}.${words[7] & 0xff}`;
    if (isBlockedV4Literal(v4)) return true;
  }
  return false;
};

const isBlockedIp = (ip: string): boolean => {
  const bare = ip.split('%')[0].toLowerCase();
  const family = net.isIP(bare);
  if (family === 4) return isBlockedV4Literal(bare);
  if (family === 6) return isBlockedV6Literal(bare);
  return true;
};

export const assertEgressUrl = async (raw: string): Promise<string> => {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return deny();
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostname === '') deny();

  // http egress is only for loopback local dev targets
  if (parsed.protocol === 'http:') {
    if (hostname !== '127.0.0.1' && hostname !== 'localhost') deny();
    return raw;
  }
  if (parsed.protocol !== 'https:') deny();

  if (net.isIP(hostname) !== 0) {
    if (isBlockedIp(hostname)) deny();
    return raw;
  }

  const { promise, resolve, reject } = Promise.withResolvers<dns.LookupAddress[]>();
  dns.lookup(hostname, { all: true }, (error, addresses) => {
    if (error) reject(error);
    else resolve(addresses);
  });
  let resolved: dns.LookupAddress[];
  try {
    resolved = await promise;
  } catch {
    return deny();
  }
  if (resolved.length === 0) return deny();
  for (const entry of resolved) {
    if (isBlockedIp(entry.address)) deny();
  }

  // dns rebinding residual risk documented in the audit report: the name
  // could flip to a loopback record between this check and the fetch
  return raw;
};

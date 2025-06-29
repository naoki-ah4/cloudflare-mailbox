/**
 * CIDR判定ユーティリティ
 * IPv4/IPv6のCIDR範囲でIPアドレスをチェック
 */

/**
 * IPv4アドレスを32bit整数に変換
 */
const ipv4ToInt = (ip: string): number => {
  const parts = ip.split('.').map(Number);
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * IPv4のCIDR判定
 */
const isIPv4InCIDR = (ip: string, cidr: string): boolean => {
  const [network, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);

  if (prefix < 0 || prefix > 32) return false;

  const ipInt = ipv4ToInt(ip);
  const networkInt = ipv4ToInt(network);
  const mask = ~((1 << (32 - prefix)) - 1);

  return (ipInt & mask) === (networkInt & mask);
}

/**
 * IPv6アドレスを128bit配列に変換
 */
const ipv6ToBytes = (ip: string): Uint8Array => {
  // IPv6正規化（::の展開など）
  let normalized = ip;
  if (normalized.includes('::')) {
    const parts = normalized.split('::');
    const leftParts = parts[0] ? parts[0].split(':') : [];
    const rightParts = parts[1] ? parts[1].split(':') : [];
    const missingParts = 8 - leftParts.length - rightParts.length;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    normalized = [...leftParts, ...Array(missingParts).fill('0'), ...rightParts].join(':');
  }

  const parts = normalized.split(':');
  const bytes = new Uint8Array(16);

  for (let i = 0; i < 8; i++) {
    const hex = parseInt(parts[i] || '0', 16);
    bytes[i * 2] = (hex >> 8) & 0xff;
    bytes[i * 2 + 1] = hex & 0xff;
  }

  return bytes;
}

/**
 * IPv6のCIDR判定
 */
const isIPv6InCIDR = (ip: string, cidr: string): boolean => {
  const [network, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);

  if (prefix < 0 || prefix > 128) return false;

  const ipBytes = ipv6ToBytes(ip);
  const networkBytes = ipv6ToBytes(network);

  const fullBytes = Math.floor(prefix / 8);
  const remainingBits = prefix % 8;

  // フルバイトの比較
  for (let i = 0; i < fullBytes; i++) {
    if (ipBytes[i] !== networkBytes[i]) return false;
  }

  // 残りビットの比較
  if (remainingBits > 0) {
    const mask = 0xff << (8 - remainingBits);
    if ((ipBytes[fullBytes] & mask) !== (networkBytes[fullBytes] & mask)) {
      return false;
    }
  }

  return true;
}

/**
 * IPアドレスがIPv6かどうか判定
 */
const isIPv6 = (ip: string): boolean => {
  return ip.includes(':');
}

/**
 * IPアドレスがCIDR範囲内かチェック
 */
export const isIPInCIDR = (ip: string, cidr: string): boolean => {
  if (!ip || !cidr) return false;

  try {
    if (isIPv6(ip) && isIPv6(cidr)) {
      return isIPv6InCIDR(ip, cidr);
    } else if (!isIPv6(ip) && !isIPv6(cidr)) {
      return isIPv4InCIDR(ip, cidr);
    }
    return false;
  } catch (error) {
    console.error('CIDR判定エラー:', error);
    return false;
  }
}

/**
 * 複数のCIDR範囲をチェック（カンマ区切り）
 */
export const isIPInCIDRList = (ip: string, cidrList: string): boolean => {
  if (!ip || !cidrList) return false;

  const cidrs = cidrList.split(',').map(c => c.trim());
  return cidrs.some(cidr => isIPInCIDR(ip, cidr));
}
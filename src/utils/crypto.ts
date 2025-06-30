/**
 * パスワードハッシュ化・検証ユーティリティ
 * 既存の実装（SHA-256 + 固定salt）と互換性を保持
 */

const SALT = 'salt'; // 既存実装との互換性のため固定salt使用

/**
 * パスワードをハッシュ化
 */
export const hashPassword = async (password: string): Promise<string> => {
  const passwordHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(password + SALT)
  );
  
  return Array.from(new Uint8Array(passwordHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * パスワードを検証
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const computedHash = await hashPassword(password);
  return computedHash === hash;
};
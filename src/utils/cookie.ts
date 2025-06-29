/**
 * セキュアなクッキー設定を生成
 * 開発環境では Secure フラグを除外
 */
export function createSecureCookieHeader(
  name: string,
  value: string,
  options: {
    maxAge?: number;
    httpOnly?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    env?: Env;
  } = {}
): string {
  const {
    maxAge = 7 * 24 * 60 * 60, // 7日間
    httpOnly = true,
    sameSite = 'Strict',
    env
  } = options;

  const isDevelopment = env?.NODE_ENV === 'development';
  const secureFlag = isDevelopment ? '' : '; Secure';
  const httpOnlyFlag = httpOnly ? '; HttpOnly' : '';

  return `${name}=${value}${httpOnlyFlag}${secureFlag}; SameSite=${sameSite}; Max-Age=${maxAge}`;
}
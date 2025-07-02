/**
 * XSS対策のためのサニタイゼーション用ユーティリティ
 */

import DOMPurify from 'dompurify';

// 許可するCSSプロパティの定義
const ALLOWED_CSS_PROPERTIES = [
  'color', 'background-color', 'background', 'border', 'border-color', 'border-style', 'border-width',
  'border-top', 'border-bottom', 'border-left', 'border-right',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'text-align', 'text-decoration', 'text-transform', 'letter-spacing',
  'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
  'display', 'float', 'clear', 'vertical-align', 'text-indent'
];

/**
 * 危険なCSS値をチェックする関数
 */
const isDangerousCSS = (value: string): boolean => {
  const dangerousPatterns = [
    /expression\s*\(/i,
    /javascript\s*:/i,
    /vbscript\s*:/i,
    /url\s*\(\s*["']?\s*javascript/i,
    /url\s*\(\s*["']?\s*vbscript/i,
    /@import/i,
    /behavior\s*:/i,
    /-moz-binding/i
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(value));
};

/**
 * CSSスタイルを検証する関数
 */
const validateCSSStyles = (styleElement: HTMLElement): string => {
  const output: string[] = [];
  const styles = styleElement.style;
  
  for (let i = 0; i < styles.length; i++) {
    const property = styles[i];
    const value = styles.getPropertyValue(property);
    
    // 許可されたプロパティかチェック
    if (ALLOWED_CSS_PROPERTIES.includes(property)) {
      // 危険な値をチェック
      if (!isDangerousCSS(value)) {
        output.push(`${property}: ${value}`);
      }
    }
  }
  
  return output.join('; ');
};

/**
 * HTMLコンテンツをサニタイズ（メール表示用）
 * 安全なHTMLタグのみを許可し、スクリプトやイベントハンドラを除去
 */
export const sanitizeHTML = (html: string, options: { allowExternalImages?: boolean } = {}): string => {
  if (!html) return '';

  // フックを追加
  DOMPurify.addHook("afterSanitizeAttributes", (node: Element) => {
    // 外部リンクの安全化
    if (node.tagName === 'A' && node.getAttribute('href')) {
      const href = node.getAttribute('href');
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }

    // 外部画像の処理
    if (!options.allowExternalImages && node.tagName === 'IMG' && node.getAttribute('src')) {
      const src = node.getAttribute('src');
      if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
        // 外部画像をプレースホルダに置換
        node.removeAttribute('src');
        node.setAttribute('data-original-src', src);
        node.setAttribute('alt', '[外部画像を読み込むには許可が必要です]');
        node.setAttribute('style', 'border: 2px dashed #ccc; padding: 20px; background: #f9f9f9; text-align: center; min-height: 100px; display: flex; align-items: center; justify-content: center;');
      }
    }

    // CSSスタイルの検証
    if (node.getAttribute('style')) {
      const validatedStyle = validateCSSStyles(node as HTMLElement);
      if (validatedStyle) {
        node.setAttribute('style', validatedStyle);
      } else {
        node.removeAttribute('style');
      }
    }
  });

  const result = DOMPurify.sanitize(html, {
    // 許可するタグ
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'br', 'hr',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 'b', 'i', 'u', 's',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'a', 'img',
      'blockquote', 'pre', 'code'
    ],
    // 許可する属性
    ALLOWED_ATTR: [
      'class', 'style', 'src', 'alt', 'href', 'title',
      'width', 'height', 'cellpadding', 'cellspacing', 'border',
      'data-original-src'
    ],
    // 許可するURLスキーム（危険なスキームを除外）
    ALLOWED_URI_REGEXP: options.allowExternalImages
      ? /^(?:(?:https?|mailto|tel|ftp):)|^(?:\/|\.\/|\.\.\/)|^data:image\//i
      : /^(?:(?:https?|mailto|tel|ftp):)|^(?:\/|\.\/|\.\.\/)|^data:image\//i,
    // 外部リンクを安全にする
    ADD_ATTR: ['target', 'rel'],
    // 危険な要素を除去
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'textarea', 'iframe', 'frame', 'frameset'],
    FORBID_ATTR: ['onload', 'onclick', 'onerror', 'onmouseover', 'onmouseout', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
    // データ属性を禁止（data-original-srcは個別に許可）
    ALLOW_DATA_ATTR: false
  });

  // フックをクリーンアップ
  DOMPurify.removeAllHooks();

  return result;
};

/**
 * プレーンテキストをエスケープ（安全なHTML表示用）
 */
export const escapeHTML = (text: string): string => {
  if (!text) return '';

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * ファイル名をサニタイズ（表示用）
 * HTMLタグや特殊文字を除去
 */
export const sanitizeFileName = (filename: string): string => {
  if (!filename) return '';

  return filename
    .replace(/[<>:"\\|?*]/g, '_') // 危険な文字を置換
    .replace(/\.\./g, '__')       // パストラバーサル防止
    .trim();
};

/**
 * 検索クエリをサニタイズ（表示用）
 */
export const sanitizeSearchQuery = (query: string): string => {
  if (!query) return '';

  return escapeHTML(query.trim());
};

/**
 * メールの件名・送信者名をサニタイズ
 */
export const sanitizeEmailText = (text: string): string => {
  if (!text) return '';

  return escapeHTML(text);
};
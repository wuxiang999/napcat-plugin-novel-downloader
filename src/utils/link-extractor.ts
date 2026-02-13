/**
 * 链接识别工具
 * 
 * 支持识别七猫小说链接
 * 不支持中文关键字识别
 * 
 * @author LANHU199
 */

/**
 * 链接信息接口
 */
export interface LinkInfo {
  url: string;
  type: 'qimao' | null;
  bookId?: string;
}

/**
 * 从消息中提取链接信息
 * 
 * 支持的链接格式：
 * - https://www.qimao.com/shuku/1879266/
 * - https://qimao.com/shuku/1879266/
 * - https://wtzw.com/shuku/1879266/
 * 
 * @param text 消息文本
 * @returns 链接信息，如果没有找到则返回 null
 */
export function extractLinkInfo(text: string): LinkInfo | null {
  if (!text) return null;

  // 匹配 URL 模式
  const urlPattern = /(https?:\/\/[^\s]+)/gi;
  const urls = text.match(urlPattern);

  if (!urls || urls.length === 0) {
    return null;
  }

  const url = urls[0];

  // 检查是否是七猫链接
  if (url.includes('qimao.com') || url.includes('wtzw.com')) {
    // 提取 bookId
    // 七猫链接格式: https://www.qimao.com/shuku/1879266/
    // 或: https://wtzw.com/shuku/1879266/
    const bookIdMatch = url.match(/\/shuku\/(\d+)/);
    const bookId = bookIdMatch ? bookIdMatch[1] : extractLongestNumber(url);

    return {
      url,
      type: 'qimao',
      bookId,
    };
  }

  // 不支持的链接类型
  return null;
}

/**
 * 从 URL 中提取最长的数字串（作为 bookId）
 * 
 * @param url URL 字符串
 * @returns 最长的数字串
 */
function extractLongestNumber(url: string): string | undefined {
  const matches = url.match(/\d+/g);
  if (!matches || matches.length === 0) {
    return undefined;
  }

  // 返回最长的数字串
  return matches.reduce((a, b) => (a.length > b.length ? a : b));
}

/**
 * 检查消息是否包含链接
 * 
 * @param text 消息文本
 * @returns 是否包含链接
 */
export function hasLink(text: string): boolean {
  return /https?:\/\/[^\s]+/i.test(text);
}

/**
 * 从消息中提取所有 URL
 * 
 * @param text 消息文本
 * @returns URL 数组
 */
export function extractAllUrls(text: string): string[] {
  const urlPattern = /(https?:\/\/[^\s]+)/gi;
  const urls = text.match(urlPattern);
  return urls || [];
}

/**
 * 验证是否是有效的七猫链接
 * 
 * @param url URL 字符串
 * @returns 是否是有效的七猫链接
 */
export function isValidQimaoLink(url: string): boolean {
  return (url.includes('qimao.com') || url.includes('wtzw.com')) && /\/shuku\/\d+/.test(url);
}

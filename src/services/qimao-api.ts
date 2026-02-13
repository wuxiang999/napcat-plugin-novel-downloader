/**
 * 七猫小说 API 客户端
 * 
 * 基于 swiftcat-downloader-flutter 的实现
 * https://github.com/shing-yu/swiftcat-downloader-flutter
 * 
 * @author LANHU199
 */

import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';

// 七猫小说 API 配置
const SIGN_KEY = 'd3dGiJc651gSQ8w1';
const AES_KEY_HEX = '32343263636238323330643730396531';
const BASE_URL_BC = 'https://api-bc.wtzw.com';
const BASE_URL_KS = 'https://api-ks.wtzw.com';

const VERSION_LIST = [
  '73720', '73700', '73620', '73600', '73500', '73420', '73400',
  '73328', '73325', '73320', '73300', '73220', '73200', '73100',
  '73000', '72900', '72820', '72800', '70720', '62010', '62112',
];

// 数据接口
export interface QimaoBook {
  id: string;
  title: string;
  author: string;
  intro: string;
  wordsNum: number;
  tags: string;
  imgUrl: string;
  isOver: boolean;
  catalog?: QimaoChapter[];
}

export interface QimaoChapter {
  id: string;
  title: string;
  sort: number;
}

export interface QimaoSearchResult {
  id: string;
  title: string;
  author: string;
  isOver: boolean;
}

/**
 * 七猫小说 API 客户端
 */
export class QimaoApiClient {
  private axiosInstance: AxiosInstance;

  constructor() {
    const httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: 350,
    });
    const httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 350,
      rejectUnauthorized: false,
    });

    this.axiosInstance = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
      httpAgent,
      httpsAgent,
    });
  }

  /**
   * 生成 API 请求签名
   */
  private generateSignature(params: Record<string, any>, key: string): string {
    // 1. 按字母顺序排序参数键
    const sortedKeys = Object.keys(params).sort();
    
    // 2. 拼接 "key=value" 字符串，并在末尾添加 signKey
    const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('') + key;
    
    // 3. 计算 MD5 哈希值
    return crypto.createHash('md5').update(signStr, 'utf8').digest('hex');
  }

  /**
   * 生成 API 请求头
   */
  private getHeaders(bookId: string): Record<string, string> {
    // 使用书籍 ID 的哈希值作为随机种子
    const seed = this.hashCode(bookId);
    const version = VERSION_LIST[Math.abs(seed) % VERSION_LIST.length];
    
    const headers: Record<string, any> = {
      'AUTHORIZATION': '',
      'app-version': version,
      'application-id': 'com.****.reader',
      'channel': 'unknown',
      'net-env': '1',
      'platform': 'android',
      'qm-params': '',
      'reg': '0',
    };
    
    // 对请求头参数生成签名
    headers['sign'] = this.generateSignature(headers, SIGN_KEY);
    
    return headers;
  }

  /**
   * 字符串哈希函数（模拟 Java hashCode）
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  /**
   * 搜索小说
   */
  async searchBooks(keyword: string): Promise<QimaoSearchResult[]> {
    const params: Record<string, any> = {
      'extend': '',
      'tab': '0',
      'gender': '0',
      'refresh_state': '8',
      'page': '1',
      'wd': keyword,
      'is_short_story_user': '0'
    };
    params['sign'] = this.generateSignature(params, SIGN_KEY);

    try {
      const response = await this.axiosInstance.get(`${BASE_URL_BC}/search/v1/words`, {
        params,
        headers: this.getHeaders('00000000')
      });

      if (response.status === 200 && response.data?.data) {
        const books = response.data.data.books || [];
        return books
          .filter((json: any) => json.id && json.id.toString().trim())
          .map((json: any) => ({
            id: json.id.toString(),
            title: this.removeHtmlTags(json.title || '无书名'),
            author: this.removeHtmlTags(json.author || '未知作者'),
            isOver: json.is_over === '1'
          }));
      }
      
      return [];
    } catch (error) {
      console.error('[七猫] 搜索失败:', error);
      return [];
    }
  }

  /**
   * 获取书籍详情
   */
  async fetchBookInfo(bookId: string): Promise<QimaoBook | null> {
    const params: Record<string, any> = {
      'id': bookId,
      'imei_ip': '2937357107',
      'teeny_mode': '0'
    };
    params['sign'] = this.generateSignature(params, SIGN_KEY);

    try {
      const response = await this.axiosInstance.get(`${BASE_URL_BC}/api/v4/book/detail`, {
        params,
        headers: this.getHeaders(bookId)
      });

      if (response.status === 200 && response.data?.data) {
        const bookData = response.data.data.book;
        const tagList = bookData.book_tag_list || [];

        return {
          id: bookData.id?.toString() || '',
          title: bookData.title || '未知标题',
          author: bookData.author || '未知作者',
          intro: bookData.intro || '暂无简介',
          wordsNum: parseInt(bookData.words_num) || 0,
          tags: tagList.map((tag: any) => tag.title).join(', '),
          imgUrl: bookData.image_link || '',
          isOver: bookData.is_over === '1'
        };
      }

      return null;
    } catch (error) {
      console.error('[七猫] 获取书籍详情失败:', error);
      return null;
    }
  }

  /**
   * 获取章节列表
   */
  async fetchChapterList(bookId: string): Promise<QimaoChapter[]> {
    const params: Record<string, any> = {
      'chapter_ver': '0',
      'id': bookId
    };
    params['sign'] = this.generateSignature(params, SIGN_KEY);

    try {
      const response = await this.axiosInstance.get(`${BASE_URL_KS}/api/v1/chapter/chapter-list`, {
        params,
        headers: this.getHeaders(bookId)
      });

      if (response.status === 200 && response.data?.data?.chapter_lists) {
        const chaptersJson = response.data.data.chapter_lists;
        chaptersJson.sort((a: any, b: any) => a.chapter_sort - b.chapter_sort);
        
        return chaptersJson.map((json: any) => ({
          id: json.id?.toString() || '',
          title: json.title || '未知章节',
          sort: parseInt(json.chapter_sort) || 0
        }));
      }

      return [];
    } catch (error) {
      console.error('[七猫] 获取章节列表失败:', error);
      return [];
    }
  }

  /**
   * 获取章节内容
   */
  async fetchChapterContent(bookId: string, chapterId: string): Promise<string> {
    const params: Record<string, any> = {
      'chapter_id': chapterId,
      'id': bookId
    };
    params['sign'] = this.generateSignature(params, SIGN_KEY);

    try {
      const response = await this.axiosInstance.get(`${BASE_URL_KS}/api/v1/chapter/content`, {
        params,
        headers: this.getHeaders(bookId)
      });

      if (response.status === 200 && response.data?.data) {
        let content = response.data.data.content;
        
        // 如果内容是加密的，尝试解密
        if (content && typeof content === 'string') {
          try {
            content = this.decryptChapterContent(content);
          } catch {
            // 如果解密失败，返回原始内容
          }
        }
        
        // 清洗内容
        return this.cleanContent(content || '');
      }

      return '';
    } catch (error) {
      console.error('[七猫] 获取章节内容失败:', error);
      return '';
    }
  }

  /**
   * 清洗章节内容
   */
  private cleanContent(raw: string): string {
    if (!raw) return '';
    
    // 1. 解码 HTML 实体
    let content = raw
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    
    // 2. 将 </p> 标签转换为换行符
    content = content.replace(/<\/p>/g, '\n');
    
    // 3. 移除所有 HTML 标签
    content = content.replace(/<[^>]+>/g, '');
    
    // 4. 清理乱码字符（保留中文、英文、数字、常用标点）
    content = content.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s，。！？；""''（）【】\n\t]/g, '');
    
    // 5. 清理每行首尾空格
    content = content.replace(/^\s+|\s+$/gm, '');
    
    // 6. 清理行内多余空格
    content = content.replace(/[ \t]+/g, ' ');
    
    // 7. 合并连续空行
    content = content.replace(/\n+/g, '\n').trim();
    
    return content;
  }

  /**
   * 解密章节内容
   */
  private decryptChapterContent(encryptedContent: string): string {
    try {
      // 将 Base64 字符串解码为 Buffer
      const encryptedBytes = Buffer.from(encryptedContent, 'base64');
      
      // 提取前 16 字节作为 IV
      const iv = encryptedBytes.slice(0, 16);
      
      // 剩余字节作为加密数据
      const encrypted = encryptedBytes.slice(16);
      
      // 将十六进制密钥转换为 Buffer
      const key = Buffer.from(AES_KEY_HEX, 'hex');
      
      // 使用 AES-CBC 模式解密
      const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('[七猫] 解密失败:', error);
      return encryptedContent;
    }
  }

  /**
   * 移除 HTML 标签
   */
  private removeHtmlTags(htmlText: string): string {
    return htmlText.replace(/<[^>]*>/g, '');
  }
}

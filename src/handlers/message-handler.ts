import type { NapCatPluginContext, OB11Message } from 'napcat-types';
import { pluginState } from '../core/state';
import { NovelDownloader } from '../services/novel-downloader';
import { extractLinkInfo, hasLink } from '../utils/link-extractor';

/**
 * 消息处理器
 * 
 * 处理用户的小说搜索和下载命令
 * 支持链接识别（七猫小说）
 * 
 * 七猫小说API实现参考:
 * https://github.com/shing-yu/swiftcat-downloader-flutter
 * 
 * @author LANHU199
 */

const downloader = new NovelDownloader();

/**
 * 处理消息
 */
export async function handleMessage(ctx: NapCatPluginContext, event: OB11Message): Promise<void> {
  const message = event.raw_message?.trim() || '';
  const userId = String(event.user_id);
  const groupId = event.message_type === 'group' ? String(event.group_id) : '';

  // 检查是否是群主
  let isGroupOwner = false;
  if (groupId && event.sender) {
    isGroupOwner = event.sender.role === 'owner';
  }

  // 首先检查是否包含链接
  if (hasLink(message)) {
    const linkInfo = extractLinkInfo(message);
    if (linkInfo && linkInfo.type === 'qimao' && linkInfo.bookId) {
      // 自动识别七猫链接并下载
      await handleLinkDownload(ctx, event, linkInfo.bookId, isGroupOwner);
      return;
    }
  }

  // 搜索小说
  if (message.startsWith('搜索小说 ') || message.startsWith('搜小说 ')) {
    const keyword = message.replace(/^(搜索小说|搜小说)\s+/, '').trim();
    if (!keyword) {
      await sendMessage(ctx, event, '❌ 请输入搜索关键词\n用法: 搜索小说 书名');
      return;
    }

    await sendMessage(ctx, event, '🔍 正在搜索...');
    
    try {
      const results = await downloader.searchNovel(keyword);
      if (results.length === 0) {
        await sendMessage(ctx, event, '❌ 未找到相关小说');
        return;
      }

      let reply = `📚 搜索结果 (共${results.length}个):\n\n`;
      results.slice(0, 5).forEach((book, index) => {
        reply += `${index + 1}. ${book.book_name}\n`;
        reply += `   作者: ${book.author}\n`;
        if (book.status) reply += `   状态: ${book.status}\n`;
        reply += `   ID: ${book.book_id}\n\n`;
      });
      reply += '💡 发送 "下载小说 书籍ID" 开始下载';

      await sendMessage(ctx, event, reply);
    } catch (error) {
      pluginState.logger.error('搜索失败:', error);
      await sendMessage(ctx, event, '❌ 搜索失败，请稍后重试');
    }
    return;
  }

  // 查看小说详情
  if (message.startsWith('小说详情 ') || message.startsWith('书籍详情 ')) {
    const bookId = message.replace(/^(小说详情|书籍详情)\s+/, '').trim();
    if (!bookId) {
      await sendMessage(ctx, event, '❌ 请输入书籍ID\n用法: 小说详情 书籍ID');
      return;
    }

    await sendMessage(ctx, event, '📖 正在获取详情...');
    
    try {
      const bookInfo = await downloader.getBookInfo(bookId);
      if (!bookInfo) {
        await sendMessage(ctx, event, '❌ 未找到该小说');
        return;
      }

      // 发送详细信息卡片（类似 Koishi 插件）
      let card = `━━━━━━━━━━━━━━━━━━\n`;
      card += `📚 ${bookInfo.book_name}\n`;
      card += `━━━━━━━━━━━━━━━━━━\n\n`;
      card += `✍️ 作者: ${bookInfo.author}\n`;
      card += `📖 来源: ${bookInfo.source}\n`;
      if (bookInfo.status) card += `📊 状态: ${bookInfo.status}\n`;
      if (bookInfo.word_number) card += `📝 字数: ${bookInfo.word_number}\n`;
      if (bookInfo.category) card += `🏷️ 分类: ${bookInfo.category}\n`;
      if (bookInfo.abstract) {
        card += `\n📄 简介:\n${bookInfo.abstract.substring(0, 100)}${bookInfo.abstract.length > 100 ? '...' : ''}\n`;
      }
      card += `\n━━━━━━━━━━━━━━━━━━\n`;
      card += `💡 发送 "下载小说 ${bookId}" 开始下载`;

      await sendMessage(ctx, event, card);
    } catch (error) {
      pluginState.logger.error('获取详情失败:', error);
      await sendMessage(ctx, event, '❌ 获取详情失败，请稍后重试');
    }
    return;
  }

  // 下载小说
  if (message.startsWith('下载小说 ') || message.startsWith('下小说 ')) {
    const input = message.replace(/^(下载小说|下小说)\s+/, '').trim();
    if (!input) {
      await sendMessage(ctx, event, '❌ 请输入书籍ID\n用法: 下载小说 书籍ID');
      return;
    }

    // 检查权限（管理员和群主无限制）
    const check = pluginState.canUserDownload(userId, isGroupOwner);
    if (!check.allowed) {
      await sendMessage(ctx, event, `❌ ${check.reason}`);
      return;
    }

    // 检查是否已有下载任务
    if (pluginState.activeDownloads.has(userId)) {
      await sendMessage(ctx, event, '❌ 您已有正在进行的下载任务\n发送 "下载进度" 查看进度');
      return;
    }

    // 解析书籍ID
    const bookId = input.split(/\s+/)[0];

    // 先获取书籍详情
    await sendMessage(ctx, event, '📖 正在获取书籍信息...');
    
    try {
      const bookInfo = await downloader.getBookInfo(bookId);
      if (!bookInfo) {
        await sendMessage(ctx, event, '❌ 未找到该小说');
        return;
      }

      // 发送详情卡片
      let card = `━━━━━━━━━━━━━━━━━━\n`;
      card += `📚 ${bookInfo.book_name}\n`;
      card += `━━━━━━━━━━━━━━━━━━\n\n`;
      card += `✍️ 作者: ${bookInfo.author}\n`;
      card += `📖 来源: ${bookInfo.source}\n`;
      if (bookInfo.status) card += `📊 状态: ${bookInfo.status}\n`;
      if (bookInfo.word_number) card += `📝 字数: ${bookInfo.word_number}\n`;
      if (bookInfo.category) card += `🏷️ 分类: ${bookInfo.category}\n`;
      card += `\n📥 开始下载中，请稍候...\n`;
      card += `━━━━━━━━━━━━━━━━━━`;

      await sendMessage(ctx, event, card);

      // 开始下载
      await downloader.startDownload(ctx, userId, groupId, bookId, (progress) => {
        // 进度回调
        if (progress.status === 'completed') {
          const duration = Math.round((Date.now() - progress.startTime) / 1000);
          let successMsg = `✅ 下载完成！\n\n`;
          successMsg += `📚 书名: ${bookInfo.book_name}\n`;
          successMsg += `✍️ 作者: ${bookInfo.author}\n`;
          successMsg += `📖 章节: ${progress.totalChapters} 章\n`;
          successMsg += `⏱️ 用时: ${duration}秒\n`;
          successMsg += `📁 格式: ${pluginState.config.outputFormat.toUpperCase()}`;
          
          sendMessage(ctx, event, successMsg);
        } else if (progress.status === 'failed') {
          sendMessage(ctx, event, `❌ 下载失败: ${progress.error}`);
        }
      });

      pluginState.incrementDownloadCount(userId);
    } catch (error) {
      pluginState.logger.error('下载失败:', error);
      await sendMessage(ctx, event, `❌ 下载失败: ${error}`);
    }
    return;
  }

  // 查看下载进度
  if (message === '下载进度' || message === '进度') {
    const task = pluginState.activeDownloads.get(userId);
    if (!task) {
      await sendMessage(ctx, event, '❌ 当前没有下载任务');
      return;
    }

    const { status } = task;
    let reply = `━━━━━━━━━━━━━━━━━━\n`;
    reply += `📊 下载进度\n`;
    reply += `━━━━━━━━━━━━━━━━━━\n\n`;
    reply += `📚 书名: ${task.book_info.book_name}\n`;
    reply += `✍️ 作者: ${task.book_info.author}\n`;
    reply += `📈 进度: ${status.downloadedChapters}/${status.totalChapters} (${status.progress.toFixed(1)}%)\n`;
    reply += `⚡ 速度: ${status.avgSpeed.toFixed(1)} 章/秒\n`;
    reply += `⏱️ 预计剩余: ${Math.round(status.estimatedTime)}秒\n`;
    reply += `📊 状态: ${getStatusText(status.status)}\n`;
    reply += `━━━━━━━━━━━━━━━━━━`;

    await sendMessage(ctx, event, reply);
    return;
  }

  // 取消下载
  if (message === '取消下载' || message === '停止下载') {
    const task = pluginState.activeDownloads.get(userId);
    if (!task) {
      await sendMessage(ctx, event, '❌ 当前没有下载任务');
      return;
    }

    task.abortController.abort();
    pluginState.activeDownloads.delete(userId);
    await sendMessage(ctx, event, '✅ 已取消下载');
    return;
  }

  // 帮助信息
  if (message === '小说帮助' || message === '小说菜单' || message === '小说下载帮助') {
    const help = `━━━━━━━━━━━━━━━━━━\n` +
      `📚 小说下载插件\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `🔍 搜索小说 <书名> - 搜索小说\n` +
      `📖 小说详情 <ID> - 查看详情\n` +
      `📥 下载小说 <ID> - 下载小说\n` +
      `📊 下载进度 - 查看进度\n` +
      `❌ 取消下载 - 取消任务\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📖 支持平台: 七猫小说\n` +
      `📁 支持格式: TXT, EPUB, HTML\n` +
      `👑 管理员和群主无下载限制\n` +
      `━━━━━━━━━━━━━━━━━━`;
    
    await sendMessage(ctx, event, help);
    return;
  }
}

/**
 * 发送消息
 */
async function sendMessage(ctx: NapCatPluginContext, event: OB11Message, text: string): Promise<void> {
  try {
    await ctx.actions.call('send_msg', {
      message: text,
      message_type: event.message_type,
      ...(event.message_type === 'group' ? { group_id: String(event.group_id) } : {}),
      ...(event.message_type === 'private' ? { user_id: String(event.user_id) } : {}),
    }, ctx.adapterName, ctx.pluginManager.config);
  } catch (error) {
    ctx.logger.error('发送消息失败:', error);
  }
}

/**
 * 获取状态文本
 */
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '⏳ 等待中',
    downloading: '⬇️ 下载中',
    paused: '⏸️ 已暂停',
    completed: '✅ 已完成',
    failed: '❌ 失败',
    cancelled: '🚫 已取消',
  };
  return statusMap[status] || status;
}

/**
 * 处理链接下载
 */
async function handleLinkDownload(
  ctx: NapCatPluginContext,
  event: OB11Message,
  bookId: string,
  isGroupOwner: boolean
): Promise<void> {
  const userId = String(event.user_id);
  const groupId = event.message_type === 'group' ? String(event.group_id) : '';

  // 检查权限
  const check = pluginState.canUserDownload(userId, isGroupOwner);
  if (!check.allowed) {
    await sendMessage(ctx, event, `❌ ${check.reason}`);
    return;
  }

  // 检查是否已有下载任务
  if (pluginState.activeDownloads.has(userId)) {
    await sendMessage(ctx, event, '❌ 您已有正在进行的下载任务\n发送 "下载进度" 查看进度');
    return;
  }

  // 获取书籍详情
  await sendMessage(ctx, event, '🔗 检测到七猫小说链接，正在获取书籍信息...');

  try {
    const bookInfo = await downloader.getBookInfo(bookId);
    if (!bookInfo) {
      await sendMessage(ctx, event, '❌ 未找到该小说');
      return;
    }

    // 发送详情卡片
    let card = `━━━━━━━━━━━━━━━━━━\n`;
    card += `📚 ${bookInfo.book_name}\n`;
    card += `━━━━━━━━━━━━━━━━━━\n\n`;
    card += `✍️ 作者: ${bookInfo.author}\n`;
    card += `📖 来源: ${bookInfo.source}\n`;
    if (bookInfo.status) card += `📊 状态: ${bookInfo.status}\n`;
    if (bookInfo.word_number) card += `📝 字数: ${bookInfo.word_number}\n`;
    if (bookInfo.category) card += `🏷️ 分类: ${bookInfo.category}\n`;
    card += `\n📥 开始下载中，请稍候...\n`;
    card += `━━━━━━━━━━━━━━━━━━`;

    await sendMessage(ctx, event, card);

    // 开始下载
    await downloader.startDownload(ctx, userId, groupId, bookId, (progress) => {
      // 进度回调
      if (progress.status === 'completed') {
        const duration = Math.round((Date.now() - progress.startTime) / 1000);
        let successMsg = `✅ 下载完成！\n\n`;
        successMsg += `📚 书名: ${bookInfo.book_name}\n`;
        successMsg += `✍️ 作者: ${bookInfo.author}\n`;
        successMsg += `📖 章节: ${progress.totalChapters} 章\n`;
        successMsg += `⏱️ 用时: ${duration}秒\n`;
        successMsg += `📁 格式: ${pluginState.config.outputFormat.toUpperCase()}`;

        sendMessage(ctx, event, successMsg);
      } else if (progress.status === 'failed') {
        sendMessage(ctx, event, `❌ 下载失败: ${progress.error}`);
      }
    });

    pluginState.incrementDownloadCount(userId);
  } catch (error) {
    pluginState.logger.error('链接下载失败:', error);
    await sendMessage(ctx, event, `❌ 下载失败: ${error}`);
  }
}

import type { NapCatPluginContext, OB11Message } from 'napcat-types';
import { pluginState } from '../core/state';
import { NovelDownloader } from '../services/novel-downloader';

/**
 * 消息处理器
 * 
 * 处理用户的小说搜索和下载命令
 * 
 * 七猫小说API实现参考:
 * https://github.com/shing-yu/swiftcat-downloader-flutter
 */

const downloader = new NovelDownloader();

/**
 * 处理消息
 */
export async function handleMessage(ctx: NapCatPluginContext, event: OB11Message): Promise<void> {
  const message = event.raw_message?.trim() || '';
  const userId = String(event.user_id);
  const groupId = event.message_type === 'group' ? String(event.group_id) : '';

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
        reply += `   来源: ${book.source}\n`;
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

  // 下载小说
  if (message.startsWith('下载小说 ') || message.startsWith('下小说 ')) {
    const input = message.replace(/^(下载小说|下小说)\s+/, '').trim();
    if (!input) {
      await sendMessage(ctx, event, '❌ 请输入书籍ID或链接\n用法: 下载小说 书籍ID');
      return;
    }

    // 检查权限
    const check = pluginState.canUserDownload(userId);
    if (!check.allowed) {
      await sendMessage(ctx, event, `❌ ${check.reason}`);
      return;
    }

    // 检查是否已有下载任务
    if (pluginState.activeDownloads.has(userId)) {
      await sendMessage(ctx, event, '❌ 您已有正在进行的下载任务\n发送 "下载进度" 查看进度');
      return;
    }

    await sendMessage(ctx, event, '📥 正在准备下载...');

    try {
      // 解析输入（书籍ID或链接）
      const bookId = input.split(/\s+/)[0];
      const platform = '七猫';

      // 开始下载
      await downloader.startDownload(ctx, userId, groupId, bookId, platform, (progress) => {
        // 进度回调
        if (progress.status === 'completed') {
          sendMessage(ctx, event, `✅ 下载完成！\n📚 ${progress.totalChapters} 章节\n⏱️ 用时 ${Math.round((Date.now() - progress.startTime) / 1000)}秒`);
        } else if (progress.status === 'failed') {
          sendMessage(ctx, event, `❌ 下载失败: ${progress.error}`);
        }
      });

      pluginState.incrementDownloadCount(userId);
    } catch (error) {
      pluginState.logger.error('下载失败:', error);
      await sendMessage(ctx, event, '❌ 下载失败，请稍后重试');
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
    let reply = `📊 下载进度\n\n`;
    reply += `📚 书名: ${task.book_info.book_name}\n`;
    reply += `✍️ 作者: ${task.book_info.author}\n`;
    reply += `📈 进度: ${status.downloadedChapters}/${status.totalChapters} (${status.progress.toFixed(1)}%)\n`;
    reply += `⚡ 速度: ${status.avgSpeed.toFixed(1)} 章/秒\n`;
    reply += `⏱️ 预计剩余: ${Math.round(status.estimatedTime)}秒\n`;
    reply += `📊 状态: ${getStatusText(status.status)}`;

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
  if (message === '小说帮助' || message === '小说菜单') {
    const help = `📚 小说下载插件\n\n` +
      `🔍 搜索小说 <书名> - 搜索小说\n` +
      `📥 下载小说 <ID> - 下载小说\n` +
      `📊 下载进度 - 查看进度\n` +
      `❌ 取消下载 - 取消任务\n\n` +
      `支持平台: 七猫`;
    
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
    pending: '等待中',
    downloading: '下载中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  };
  return statusMap[status] || status;
}

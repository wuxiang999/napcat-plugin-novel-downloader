import type { PluginConfigSchema, NapCatPluginContext } from 'napcat-types';
import type { PluginConfig } from './types';

/**
 * 插件配置模块
 * 
 * 七猫小说API实现参考:
 * https://github.com/shing-yu/swiftcat-downloader-flutter
 */

/**
 * 默认配置
 */
export const defaultConfig: PluginConfig = {
  enabled: true,
  adminQQ: [],
  dailyLimit: 5,
  maxChapterLimit: 500,
  downloadDir: './novels',
  maxConcurrentTasks: 3,
  apiConcurrency: 350,
  outputFormat: 'txt',
  debug: false,
};

/**
 * 构建配置 Schema（用于 NapCat WebUI）
 */
export function buildConfigSchema(ctx: NapCatPluginContext): PluginConfigSchema {
  const { NapCatConfig } = ctx;

  return NapCatConfig.combine(
    NapCatConfig.boolean('enabled', '启用插件', true, '是否启用小说下载功能'),
    
    NapCatConfig.html('<h3>👑 权限设置</h3>'),
    NapCatConfig.text('adminQQ', '管理员QQ', '', '多个QQ号用逗号分隔，管理员和群主无下载限制'),
    
    NapCatConfig.html('<h3>📊 下载限制</h3>'),
    NapCatConfig.number('dailyLimit', '每日下载限制', 5, '普通用户每日可下载小说数量（管理员和群主无限制）'),
    NapCatConfig.number('maxChapterLimit', '最大章节限制', 500, '单本小说最大章节数（防止下载超大小说）'),
    
    NapCatConfig.html('<h3>⚙️ 性能设置</h3>'),
    NapCatConfig.number('maxConcurrentTasks', '最大并发任务', 3, '同时进行的下载任务数'),
    NapCatConfig.number('apiConcurrency', 'API并发数', 350, '单个任务的章节并发下载数'),
    
    NapCatConfig.html('<h3>📁 存储设置</h3>'),
    NapCatConfig.text('downloadDir', '下载目录', './novels', '小说文件保存目录'),
    NapCatConfig.select('outputFormat', '输出格式', 'txt', '小说文件输出格式', [
      { label: 'TXT 文本', value: 'txt' },
      { label: 'EPUB 电子书', value: 'epub' },
      { label: 'HTML 网页', value: 'html' }
    ]),
    
    NapCatConfig.html('<h3>🔧 调试选项</h3>'),
    NapCatConfig.boolean('debug', '调试模式', false, '开启后显示详细日志'),
  );
}

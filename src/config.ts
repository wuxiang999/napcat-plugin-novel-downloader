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

  const schema = [];

  // 基础设置
  schema.push(NapCatConfig.boolean('enabled', '启用插件', true, '是否启用小说下载功能'));
  
  // 权限设置
  schema.push(NapCatConfig.html('<h3>👑 权限设置</h3>'));
  schema.push(NapCatConfig.text('adminQQ', '管理员QQ', '', '多个QQ号用逗号分隔'));
  
  // 下载限制
  schema.push(NapCatConfig.html('<h3>📊 下载限制</h3>'));
  schema.push(NapCatConfig.number('dailyLimit', '每日下载限制', 5, '普通用户每日可下载小说数量'));
  schema.push(NapCatConfig.number('maxChapterLimit', '最大章节限制', 500, '单本小说最大章节数'));
  
  // 性能设置
  schema.push(NapCatConfig.html('<h3>⚙️ 性能设置</h3>'));
  schema.push(NapCatConfig.number('maxConcurrentTasks', '最大并发任务', 3, '同时进行的下载任务数'));
  schema.push(NapCatConfig.number('apiConcurrency', 'API并发数', 350, '单个任务的章节并发下载数'));
  
  // 存储设置
  schema.push(NapCatConfig.html('<h3>📁 存储设置</h3>'));
  schema.push(NapCatConfig.text('downloadDir', '下载目录', './novels', '小说文件保存目录'));
  
  // 输出格式 - 使用 text 而不是 select
  schema.push(NapCatConfig.text('outputFormat', '输出格式', 'txt', '输出格式: txt/epub/html'));
  
  // 调试选项
  schema.push(NapCatConfig.html('<h3>🔧 调试选项</h3>'));
  schema.push(NapCatConfig.boolean('debug', '调试模式', false, '开启后显示详细日志'));

  return schema as PluginConfigSchema;
}

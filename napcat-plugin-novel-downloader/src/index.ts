/**
 * NapCat 小说下载插件
 * 
 * 支持七猫小说搜索和下载
 * 
 * 鸣谢:
 * - swiftcat-downloader-flutter (https://github.com/shing-yu/swiftcat-downloader-flutter)
 *   七猫小说API实现参考
 * 
 * @author Novel Downloader Team
 * @license MIT
 */

import type { PluginModule, PluginConfigSchema } from 'napcat-types';
import { EventType } from 'napcat-types';
import { buildConfigSchema } from './config';
import { pluginState } from './core/state';
import { handleMessage } from './handlers/message-handler';
import type { PluginConfig } from './types';

export let plugin_config_ui: PluginConfigSchema = [];

/**
 * 插件初始化
 */
export const plugin_init: PluginModule['plugin_init'] = async (ctx) => {
  try {
    pluginState.init(ctx);
    ctx.logger.info('📚 小说下载插件初始化中...');

    // 生成配置 Schema
    plugin_config_ui = buildConfigSchema(ctx);

    ctx.logger.info('✅ 小说下载插件初始化完成');
    ctx.logger.info(`📁 下载目录: ${pluginState.config.downloadDir}`);
    ctx.logger.info(`⚡ 并发任务数: ${pluginState.config.maxConcurrentTasks}`);
    ctx.logger.info(`🚀 API并发数: ${pluginState.config.apiConcurrency}`);
  } catch (error) {
    ctx.logger.error('❌ 插件初始化失败:', error);
  }
};

/**
 * 消息处理
 */
export const plugin_onmessage: PluginModule['plugin_onmessage'] = async (ctx, event) => {
  if (event.post_type !== EventType.MESSAGE) return;
  if (!pluginState.config.enabled) return;
  
  await handleMessage(ctx, event);
};

/**
 * 插件卸载
 */
export const plugin_cleanup: PluginModule['plugin_cleanup'] = async (ctx) => {
  try {
    pluginState.cleanup();
    ctx.logger.info('📚 小说下载插件已卸载');
  } catch (e) {
    ctx.logger.warn('插件卸载时出错:', e);
  }
};

/**
 * 获取配置
 */
export const plugin_get_config: PluginModule['plugin_get_config'] = async (ctx) => {
  return pluginState.config;
};

/**
 * 设置配置
 */
export const plugin_set_config: PluginModule['plugin_set_config'] = async (ctx, config) => {
  pluginState.replaceConfig(config as PluginConfig);
  ctx.logger.info('配置已更新');
};

/**
 * 配置变更回调
 */
export const plugin_on_config_change: PluginModule['plugin_on_config_change'] = async (
  ctx, ui, key, value, currentConfig
) => {
  try {
    pluginState.updateConfig({ [key]: value });
    ctx.logger.debug(`配置项 ${key} 已更新`);
  } catch (err) {
    ctx.logger.error(`更新配置项 ${key} 失败:`, err);
  }
};

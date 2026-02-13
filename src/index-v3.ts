/**
 * NapCat 小说下载插件 - 测试版本 v3
 * 
 * 在 v1 基础上添加完整配置UI，但使用简化的类型导入
 * 
 * @author LANHU199
 */

import { buildConfigSchema } from './config-simple';
import { pluginState } from './core/state';
import { handleMessage } from './handlers/message-handler';

export let plugin_config_ui: any = [];

export const plugin_init = async (ctx: any) => {
  try {
    pluginState.init(ctx);
    ctx.logger.info('📚 小说下载插件初始化中...');

    // 生成配置 Schema
    plugin_config_ui = buildConfigSchema(ctx);

    ctx.logger.info('✅ 小说下载插件初始化完成');
    ctx.logger.info(`📁 下载目录: ${pluginState.config.downloadDir}`);
    ctx.logger.info(`⚡ 并发任务数: ${pluginState.config.maxConcurrentTasks}`);
  } catch (error) {
    ctx.logger.error('❌ 插件初始化失败:', error);
  }
};

export const plugin_onmessage = async (ctx: any, event: any) => {
  if (event.post_type !== 'message') return;
  if (!pluginState.config.enabled) return;
  
  await handleMessage(ctx, event);
};

export const plugin_cleanup = async (ctx: any) => {
  try {
    pluginState.cleanup();
    ctx.logger.info('📚 小说下载插件已卸载');
  } catch (e) {
    ctx.logger.warn('插件卸载时出错:', e);
  }
};

export const plugin_get_config = async (ctx: any) => {
  return pluginState.config;
};

export const plugin_set_config = async (ctx: any, config: any) => {
  pluginState.replaceConfig(config);
  ctx.logger.info('配置已更新');
};

export const plugin_on_config_change = async (
  ctx: any, ui: any, key: string, value: any, currentConfig: any
) => {
  try {
    pluginState.updateConfig({ [key]: value });
    ctx.logger.debug(`配置项 ${key} 已更新`);
  } catch (err) {
    ctx.logger.error(`更新配置项 ${key} 失败:`, err);
  }
};

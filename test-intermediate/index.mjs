/**
 * 中间测试版本 - 包含基本结构但不使用外部依赖
 */

import { EventType } from 'napcat-types';

// 简单的配置
const defaultConfig = {
  enabled: true,
  adminQQ: [],
  dailyLimit: 5,
};

let config = { ...defaultConfig };

export let plugin_config_ui = [];

export const plugin_init = async (ctx) => {
  try {
    ctx.logger.info('📚 小说下载插件初始化中...');
    
    // 构建配置 UI
    const { NapCatConfig } = ctx;
    plugin_config_ui = NapCatConfig.combine(
      NapCatConfig.boolean('enabled', '启用插件', true, '是否启用小说下载功能'),
      NapCatConfig.text('adminQQ', '管理员QQ', '', '多个QQ号用逗号分隔'),
      NapCatConfig.number('dailyLimit', '每日下载限制', 5, '普通用户每日可下载小说数量')
    );
    
    ctx.logger.info('✅ 小说下载插件初始化完成');
  } catch (error) {
    ctx.logger.error('❌ 插件初始化失败:', error);
  }
};

export const plugin_onmessage = async (ctx, event) => {
  if (event.post_type !== EventType.MESSAGE) return;
  if (!config.enabled) return;
  
  const message = event.raw_message?.trim() || '';
  
  // 简单的命令响应
  if (message === '小说帮助' || message === '小说菜单') {
    try {
      await ctx.actions.call('send_msg', {
        message: '📚 小说下载插件\n\n这是测试版本，功能开发中...',
        message_type: event.message_type,
        ...(event.message_type === 'group' ? { group_id: String(event.group_id) } : {}),
        ...(event.message_type === 'private' ? { user_id: String(event.user_id) } : {}),
      }, ctx.adapterName, ctx.pluginManager.config);
    } catch (error) {
      ctx.logger.error('发送消息失败:', error);
    }
  }
};

export const plugin_cleanup = async (ctx) => {
  ctx.logger.info('📚 小说下载插件已卸载');
};

export const plugin_get_config = async (ctx) => {
  return config;
};

export const plugin_set_config = async (ctx, newConfig) => {
  config = newConfig;
  ctx.logger.info('配置已更新');
};

export const plugin_on_config_change = async (ctx, ui, key, value, currentConfig) => {
  config[key] = value;
  ctx.logger.info(`配置项 ${key} 已更新`);
};

/**
 * 测试步骤2 - 添加 EventType 导入
 */

import { EventType } from 'napcat-types';

export let plugin_config_ui = [];

export const plugin_init = async (ctx) => {
  try {
    ctx.logger.info('📚 步骤2: 开始初始化...');
    ctx.logger.info('📚 步骤2: EventType 导入成功');
    
    const { NapCatConfig } = ctx;
    plugin_config_ui = NapCatConfig.combine(
      NapCatConfig.boolean('enabled', '启用插件', true, '是否启用')
    );
    
    ctx.logger.info('✅ 步骤2: 初始化完成');
  } catch (error) {
    ctx.logger.error('❌ 步骤2: 初始化失败:', error);
    ctx.logger.error('错误堆栈:', error.stack);
  }
};

export const plugin_onmessage = async (ctx, event) => {
  try {
    // 测试 EventType
    if (event.post_type !== EventType.MESSAGE) return;
    ctx.logger.debug('步骤2: 收到消息');
  } catch (error) {
    ctx.logger.error('步骤2: 消息处理错误:', error);
  }
};

export const plugin_cleanup = async (ctx) => {
  ctx.logger.info('📚 步骤2: 插件已卸载');
};

export const plugin_get_config = async (ctx) => {
  return { enabled: true };
};

export const plugin_set_config = async (ctx, config) => {
  ctx.logger.info('步骤2: 配置已更新');
};

export const plugin_on_config_change = async (ctx, ui, key, value, currentConfig) => {
  ctx.logger.info(`步骤2: 配置项 ${key} 已更新`);
};

/**
 * 测试步骤1 - 在最小版本基础上添加配置UI
 */

export let plugin_config_ui = [];

export const plugin_init = async (ctx) => {
  try {
    ctx.logger.info('📚 步骤1: 开始初始化...');
    
    // 尝试构建配置UI
    const { NapCatConfig } = ctx;
    
    ctx.logger.info('📚 步骤1: 构建配置UI...');
    plugin_config_ui = NapCatConfig.combine(
      NapCatConfig.boolean('enabled', '启用插件', true, '是否启用小说下载功能')
    );
    
    ctx.logger.info('✅ 步骤1: 初始化完成');
  } catch (error) {
    ctx.logger.error('❌ 步骤1: 初始化失败:', error);
    ctx.logger.error('错误堆栈:', error.stack);
  }
};

export const plugin_onmessage = async (ctx, event) => {
  // 暂不处理
};

export const plugin_cleanup = async (ctx) => {
  ctx.logger.info('📚 步骤1: 插件已卸载');
};

export const plugin_get_config = async (ctx) => {
  return { enabled: true };
};

export const plugin_set_config = async (ctx, config) => {
  ctx.logger.info('步骤1: 配置已更新');
};

export const plugin_on_config_change = async (ctx, ui, key, value, currentConfig) => {
  ctx.logger.info(`步骤1: 配置项 ${key} 已更新`);
};

/**
 * 最小化测试插件
 * 用于验证 NapCat 是否能正常加载插件
 */

export let plugin_config_ui = [];

export const plugin_init = async (ctx) => {
  ctx.logger.info('✅ 小说下载插件加载成功！');
  ctx.logger.info('📚 这是一个测试版本');
};

export const plugin_onmessage = async (ctx, event) => {
  // 暂不处理消息
};

export const plugin_cleanup = async (ctx) => {
  ctx.logger.info('📚 小说下载插件已卸载');
};

export const plugin_get_config = async (ctx) => {
  return { enabled: true };
};

export const plugin_set_config = async (ctx, config) => {
  ctx.logger.info('配置已更新');
};

export const plugin_on_config_change = async (ctx, ui, key, value, currentConfig) => {
  ctx.logger.info(`配置项 ${key} 已更新`);
};

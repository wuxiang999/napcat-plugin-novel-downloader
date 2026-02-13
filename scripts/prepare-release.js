/**
 * 准备发布包
 * 将构建产物和必要文件打包到 release 目录
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const releaseDir = path.join(rootDir, 'release');

// 清空并创建 release 目录
if (fs.existsSync(releaseDir)) {
  fs.rmSync(releaseDir, { recursive: true });
}
fs.mkdirSync(releaseDir, { recursive: true });

// 复制构建产物
console.log('📦 复制构建产物...');
const distFile = path.join(rootDir, 'dist', 'index.mjs');
if (fs.existsSync(distFile)) {
  fs.copyFileSync(distFile, path.join(releaseDir, 'index.mjs'));
  console.log('✅ index.mjs');
} else {
  console.error('❌ dist/index.mjs 不存在，请先运行 npm run build');
  process.exit(1);
}

// 创建精简的 package.json
console.log('📝 创建 package.json...');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const homepage =
  packageJson.napcat?.homepage ||
  packageJson.homepage ||
  (packageJson.repository?.url
    ? String(packageJson.repository.url).replace(/^git\+/, '').replace(/\.git$/, '')
    : '');
const releasePackageJson = {
  name: packageJson.name,
  plugin: packageJson.plugin,
  version: packageJson.version,
  type: packageJson.type,
  main: 'index.mjs',
  description: packageJson.description,
  author: packageJson.author,
  license: packageJson.license,
  keywords: packageJson.keywords,
  napcat: {
    ...packageJson.napcat,
    homepage,
  },
  dependencies: packageJson.dependencies
};
fs.writeFileSync(
  path.join(releaseDir, 'package.json'),
  JSON.stringify(releasePackageJson, null, 2)
);
console.log('✅ package.json');

// 复制 README
console.log('📄 复制文档...');
if (fs.existsSync(path.join(rootDir, 'README.md'))) {
  fs.copyFileSync(path.join(rootDir, 'README.md'), path.join(releaseDir, 'README.md'));
  console.log('✅ README.md');
}

// 复制 LICENSE
if (fs.existsSync(path.join(rootDir, 'LICENSE'))) {
  fs.copyFileSync(path.join(rootDir, 'LICENSE'), path.join(releaseDir, 'LICENSE'));
  console.log('✅ LICENSE');
}

console.log('\n✨ 发布包准备完成！');
console.log(`📁 输出目录: ${releaseDir}`);

/**
 * 准备完整发布包（包含 node_modules）
 * 将构建产物、必要文件和依赖打包到 release 目录
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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

// 创建 package.json（包含 dependencies）
console.log('📝 创建 package.json...');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const homepage =
  packageJson.napcat?.homepage ||
  packageJson.homepage ||
  (packageJson.repository?.url
    ? String(packageJson.repository.url).replace(/^git\+/, '').replace(/\.git$/, '')
    : '');

// 只包含运行时需要的依赖
const runtimeDeps = {
  'axios': packageJson.dependencies['axios'],
};

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
  dependencies: runtimeDeps
};

fs.writeFileSync(
  path.join(releaseDir, 'package.json'),
  JSON.stringify(releasePackageJson, null, 2)
);
console.log('✅ package.json');

// 安装依赖到 release 目录
console.log('\n📥 安装运行时依赖...');
try {
  execSync('npm install --production --no-package-lock', {
    cwd: releaseDir,
    stdio: 'inherit'
  });
  console.log('✅ 依赖安装完成');
} catch (error) {
  console.error('❌ 依赖安装失败:', error.message);
  process.exit(1);
}

// 复制 README
console.log('\n📄 复制文档...');
if (fs.existsSync(path.join(rootDir, 'README.md'))) {
  fs.copyFileSync(path.join(rootDir, 'README.md'), path.join(releaseDir, 'README.md'));
  console.log('✅ README.md');
}

// 复制 LICENSE
if (fs.existsSync(path.join(rootDir, 'LICENSE'))) {
  fs.copyFileSync(path.join(rootDir, 'LICENSE'), path.join(releaseDir, 'LICENSE'));
  console.log('✅ LICENSE');
}

console.log('\n✨ 完整发布包准备完成！');
console.log(`📁 输出目录: ${releaseDir}`);
console.log('\n📦 包含内容:');
console.log('  - index.mjs (插件主文件)');
console.log('  - package.json (插件配置)');
console.log('  - node_modules/ (运行时依赖)');
console.log('  - README.md (说明文档)');
console.log('  - LICENSE (许可证)');

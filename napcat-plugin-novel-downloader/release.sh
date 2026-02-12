#!/bin/bash

# NapCat 插件快速发布脚本
# 使用方法: ./release.sh 1.0.0

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查参数
if [ -z "$1" ]; then
    echo -e "${RED}❌ 错误: 请提供版本号${NC}"
    echo -e "${YELLOW}用法: ./release.sh 1.0.0${NC}"
    exit 1
fi

VERSION=$1
TAG="v${VERSION}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📦 NapCat 插件发布工具${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ 错误: 当前目录不是 git 仓库${NC}"
    exit 1
fi

# 检查是否有未提交的更改
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  警告: 有未提交的更改${NC}"
    echo -e "${YELLOW}是否继续? (y/n)${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo -e "${RED}已取消${NC}"
        exit 1
    fi
fi

# 检查 tag 是否已存在
if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo -e "${RED}❌ 错误: Tag $TAG 已存在${NC}"
    echo -e "${YELLOW}如需重新发布，请先删除旧 tag:${NC}"
    echo -e "${YELLOW}  git tag -d $TAG${NC}"
    echo -e "${YELLOW}  git push origin :refs/tags/$TAG${NC}"
    exit 1
fi

echo -e "${BLUE}📋 发布信息:${NC}"
echo -e "  版本号: ${GREEN}${VERSION}${NC}"
echo -e "  Tag: ${GREEN}${TAG}${NC}"
echo ""

# 确认发布
echo -e "${YELLOW}确认发布? (y/n)${NC}"
read -r response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo -e "${RED}已取消${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🚀 开始发布流程${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 步骤 1: 提交所有更改
echo -e "${BLUE}[1/4]${NC} 提交更改..."
if ! git diff-index --quiet HEAD --; then
    git add .
    git commit -m "chore: release v${VERSION}" || true
    echo -e "${GREEN}✓ 更改已提交${NC}"
else
    echo -e "${GREEN}✓ 没有需要提交的更改${NC}"
fi
echo ""

# 步骤 2: 推送到远程
echo -e "${BLUE}[2/4]${NC} 推送到远程仓库..."
git push origin main || git push origin master
echo -e "${GREEN}✓ 代码已推送${NC}"
echo ""

# 步骤 3: 创建并推送 tag
echo -e "${BLUE}[3/4]${NC} 创建 tag..."
git tag -a "$TAG" -m "Release $TAG"
echo -e "${GREEN}✓ Tag 已创建${NC}"
echo ""

echo -e "${BLUE}[4/4]${NC} 推送 tag..."
git push origin "$TAG"
echo -e "${GREEN}✓ Tag 已推送${NC}"
echo ""

# 完成
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 发布流程已启动！${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📝 后续步骤:${NC}"
echo -e "  1. CI 将自动构建并创建 Release"
echo -e "  2. 自动提交 PR 到插件索引仓库"
echo -e "  3. 等待索引仓库审核通过"
echo ""
echo -e "${BLUE}🔗 查看进度:${NC}"
echo -e "  GitHub Actions: ${GREEN}https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions${NC}"
echo ""
echo -e "${GREEN}✨ 完成！${NC}"

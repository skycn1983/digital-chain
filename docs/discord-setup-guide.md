# 🎉 Digital Chain Discord 社区设置指南

## 快速创建服务器

### 1. 创建服务器
1. 打开 Discord 客户端
2. 点击左下角 **"+"** 按钮
3. 选择 **"从零开始"** 或 **"使用模板"**
4. 服务器名称：`Digital Chain`
5. 上传服务器图标（建议使用项目 logo）
6. 创建完成

### 2. 频道结构

复制以下频道结构：

```
📋┃welcome
📢┃announcements
💬┃general
💻┃developers
🖥️┃node-operators
🎮┃dapps
🏆┃ecosystem-fund
❓┃ama
🎉┃off-topic
```

**创建步骤**:
- 右键点击服务器名称 → 创建频道
- 依次创建以上频道
- 使用 emoji 前缀（如 📋）便于识别

### 3. 设置欢迎消息（可选）

使用 MEE6 或 Carl-bot 机器人：
- 欢迎消息："欢迎来到 Digital Chain！🚀 请阅读 #welcome 频道了解社区规则。"
- 自动分配角色：新成员自动获得 `@Member` 角色

### 4. 生成邀请链接

1. 服务器设置 → **邀请链接**
2. 点击 **"创建邀请链接"**
3. 设置：
   - **永不过期** ✅
   - **最大使用次数**: 100（或无限）
   - **目标**: 任意成员
4. 复制链接，格式如：`https://discord.gg/XXXXXX`

### 5. 修改服务器邀请链接为品牌化

推荐：`https://discord.gg/digital-chain`（如果可用）

### 6. 权限设置

**频道权限建议**:

| 频道 | @everyone 权限 | 特殊角色 |
|------|----------------|----------|
| welcome | 仅查看 | - |
| announcements | 仅查看，禁止发言 | @Admin 可发布 |
| general | 查看+发言 | - |
| developers | 查看+发言 | - |
| node-operators | 查看+发言 | - |
| dapps | 查看+发言 | - |
| ecosystem-fund | 查看+发言 | @Admin 可管理 |
| ama | 查看+发言 | - |
| off-topic | 查看+发言 | - |

### 7. 角色创建

创建以下角色（层级从高到低）：

```
👑 Admin
🛠️ Moderator
💎 Early Adopter
👨‍💻 Developer
🖥️ Node Operator
🌱 Member
```

**权限**:
- Admin: 管理频道、踢人、封禁
- Moderator: 管理消息、静音
- Early Adopter: 特殊颜色、优先支持
- Developer: 可访问 #developers 高级讨论
- Node Operator: 可访问 #node-operators
- Member: 基础权限

### 8. 机器人集成（可选）

**GitHub 机器人**（如 GitHub Bot）:
- 同步仓库 releases、issues 到 #announcements
- 配置 webhook 到 Discord

**Stats 机器人**:
- 显示链上数据：高度、TPS、活跃节点
- 每小时更新到 #general

**MEE6**:
- 等级系统
- 自定义命令（如 `!balance <address>` 查询余额）
- 欢迎消息

### 9. 服务器设置检查清单

- [ ] 服务器名称：Digital Chain
- [ ] 服务器图标已上传
- [ ] 频道结构创建完成
- [ ] 邀请链接已生成并设置为永不过期
- [ ] 角色创建完成
- [ ] 权限配置正确
- [ ] 机器人已添加（如需要）
- [ ] 服务器描述更新："Digital Chain - AI-ready blockchain. https://github.com/skycn1983/digital-chain"
- [ ] 社区规则在 #welcome 频道发布

### 10. 发布邀请链接

将邀请链接发布到：
- GitHub README（替换占位符）
- Twitter 公告
- Reddit 帖子
- 项目官网

---

## 📋 社区管理建议

### 内容发布计划

**第 1 天**:
- 发布欢迎公告，介绍项目愿景
- 发布服务器规则

**第 1 周**:
- 每日技术问答（AMA）
- 分享 DApp 开发教程
- 发布测试网进展

**长期**:
- 每周开发更新
- 生态基金申请通知
- 社区投票治理

### 团队分工

建议招募：
- **社区经理**（1-2 人）：日常维护、回答问题
- **技术布道师**（1 人）：教程编写、AMA 主持
- **节点支持**（若干）：帮助节点部署

---

## 🔗 相关链接

- **GitHub**: https://github.com/skycn1983/digital-chain
- **官网**: (待建)
- **文档**: https://github.com/skycn1983/digital-chain#readme
- **NPM**: `@digital-chain/js`

---

**准备好了吗？开始创建 Discord 服务器吧！** 🎉

完成后，将邀请链接更新到 GitHub README 和项目文档。

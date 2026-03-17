# 🚀 测试网部署指南

本文档介绍如何部署和运行 Digital Chain 测试网。

---

## 📋 目录

1. [快速开始（Docker）](#快速开始docker)
2. [手动部署](#手动部署)
3. [云服务器部署](#云服务器部署)
4. [配置说明](#配置说明)
5. [监控与维护](#监控与维护)
6. [故障排除](#故障排除)

---

## 快速开始（Docker）

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 至少 2GB RAM
- 开放端口: 3000-3005, 8081

### 一键启动

```bash
# 1. 克隆仓库
git clone https://github.com/skycn1983/digital-chain.git
cd digital-chain

# 2. 配置环境变量
cp .env.testnet.example .env.testnet
# 编辑 .env.testnet，设置 FAUCET_ADDRESS 和 FAUCET_KEY

# 3. 启动网络（3节点 + 水龙头）
docker-compose -f docker-compose.testnet.yml up -d

# 4. 检查状态
docker-compose -f docker-compose.testnet.yml ps
docker-compose -f docker-compose.testnet.yml logs -f node1
```

### 验证部署

```bash
# 检查节点健康
curl http://localhost:3000/health
curl http://localhost:3002/health
curl http://localhost:3004/health

# 查看 P2P 连接
curl http://localhost:3000/network/peers | jq

# 访问水龙头
open http://localhost:8081
```

### 停止和清理

```bash
# 停止所有服务
docker-compose -f docker-compose.testnet.yml down

# 停止并删除数据卷（警告：会丢失链数据）
docker-compose -f docker-compose.testnet.yml down -v
```

---

## 手动部署

### 1. 安装 Node.js

```bash
# 使用 nvm 推荐
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### 2. 克隆并安装

```bash
git clone https://github.com/skycn1983/digital-chain.git
cd digital-chain
npm ci --only=production
```

### 3. 启动节点

#### 节点1（种子节点）

```bash
# 准备数据目录
mkdir -p data/node1

# 环境变量
export PORT=3000
export P2P_PORT=30001
export DATA_DIR=data/node1
export NODE_ID_SEED=node1-testnet
export SEED_NODES="127.0.0.1:30001"  # 指向自己

# 启动
node src/server.js > logs/node1.log 2>&1 &
```

#### 节点2

```bash
mkdir -p data/node2
export PORT=3002
export P2P_PORT=30003
export DATA_DIR=data/node2
export NODE_ID_SEED=node2-testnet
export SEED_NODES="127.0.0.1:30001"  # 连接节点1
node src/server.js > logs/node2.log 2>&1 &
```

#### 节点3

```bash
mkdir -p data/node3
export PORT=3004
export P2P_PORT=30005
export DATA_DIR=data/node3
export NODE_ID_SEED=node3-testnet
export SEED_NODES="127.0.0.1:30001"
node src/server.js > logs/node3.log 2>&1 &
```

### 4. 启动水龙头

```bash
cd faucet
npm ci
export NODE_URL=http://localhost:3000
export FAUCET_ADDRESS="0x你的水龙头地址"
export FAUCET_KEY="你的私钥"
node faucet.js > ../logs/faucet.log 2>&1 &
```

---

## 云服务器部署

### 推荐配置

| 规格 | 最低 | 推荐 |
|------|------|------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 2 GB | 4 GB |
| 存储 | 20 GB SSD | 50 GB SSD |
| 带宽 | 10 Mbps | 100 Mbps |
| OS | Ubuntu 20.04+ | Ubuntu 22.04 LTS |

### 部署步骤（以 Ubuntu + Docker 为例）

#### 1. 准备服务器

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

#### 2. 上传代码

```bash
# 从本地复制或克隆
scp -r digital-chain user@server:/home/user/
# 或直接在服务器克隆
git clone https://github.com/skycn1983/digital-chain.git
```

#### 3. 配置域名（可选）

```bash
# 购买域名并解析到服务器 IP
# 例如: seed.testnet.digitalchain.org -> 123.45.67.89
```

#### 4. 启动服务

```bash
cd digital-chain

# 配置环境变量
nano .env.testnet
# 设置 FAUCET_ADDRESS, FAUCET_KEY 等

# 启动所有服务
docker-compose -f docker-compose.testnet.yml up -d

# 查看日志
docker-compose -f docker-compose.testnet.yml logs -f node1
```

#### 5. 配置防火墙

```bash
# UFW 示例
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP (nginx)
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 3000/tcp    # Node1 REST
sudo ufw allow 30001/tcp   # Node1 P2P
sudo ufw allow 3002/tcp    # Node2 REST
sudo ufw allow 30003/tcp   # Node2 P2P
sudo ufw allow 3004/tcp    # Node3 REST
sudo ufw allow 30005/tcp   # Node3 P2P
sudo ufw allow 8081/tcp    # Faucet
sudo ufw enable
```

#### 6. 设置开机自启

```bash
# Docker 服务已自带自启
sudo systemctl enable docker

# 添加测试网启动脚本
cat > /etc/systemd/system/digital-chain-testnet.service << EOF
[Unit]
Description=Digital Chain Testnet
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/user/digital-chain
ExecStart=/usr/local/bin/docker-compose -f docker-compose.testnet.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.testnet.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable digital-chain-testnet
sudo systemctl start digital-chain-testnet
```

---

## 配置说明

### 环境变量

| 变量 | 说明 | 默认值 | 必填 |
|------|------|--------|------|
| `PORT` | REST API 端口 | 3000 | 是 |
| `P2P_PORT` | P2P 端口 | 30001 | 是 |
| `DATA_DIR` | 数据目录 | `/data` | 是 |
| `NODE_ID_SEED` | 节点 ID 种子 | - | 是 |
| `SEED_NODES` | 种子节点列表 | - | 是 |
| `DIFFICULTY` | 初始难度 | 2 | 否 |
| `BLOCK_REWARD` | 出块奖励 | 50 | 否 |
| `LOG_LEVEL` | 日志级别 | info | 否 |

### Docker Compose 配置

修改 `docker-compose.testnet.yml`:

- `ports`: 映射端口，按需修改
- `volumes`: 数据持久化路径
- `environment`: 环境变量

---

## 监控与维护

### 1. 查看日志

```bash
# Docker 方式
docker-compose -f docker-compose.testnet.yml logs -f node1
docker-compose -f docker-compose.testnet.yml logs -f faucet

# 手动部署
tail -f logs/node1.log
```

### 2. 链状态检查

```bash
# 查看链高度
curl http://localhost:3000/chain | jq '.stats.blocks'

# 查看最新区块
curl http://localhost:3000/chain | jq '.latestBlock'

# 查看 P2P peers
curl http://localhost:3000/network/peers | jq

# 查看网络统计
curl http://localhost:3000/network/stats | jq
```

### 3. 节点管理

```bash
# 重启节点1
docker restart dc-node1

# 停止水龙头
docker stop dc-faucet

# 查看资源占用
docker stats

# 进入容器调试
docker exec -it dc-node1 sh
```

### 4. 备份数据

```bash
# Docker 方式
docker run --rm -v digitalchain_testnet_node1-data:/data -v $(pwd):/backup alpine tar czf /backup/node1-backup.tar.gz -C /data .

# 手动部署
tar czf node1-backup.tar.gz data/node1/
```

### 5. 升级节点

```bash
# 拉取最新代码
git pull origin main

# 重建镜像
docker-compose -f docker-compose.testnet.yml build

# 重启服务
docker-compose -f docker-compose.testnet.yml down
docker-compose -f docker-compose.testnet.yml up -d

# 或滚动升级（生产环境）
docker-compose -f docker-compose.testnet.yml up -d --no-deps --build node1
```

---

## 故障排除

### 节点无法启动

**症状**: `docker-compose logs` 显示错误

**常见原因**:
- 端口被占用: `netstat -tulpn | grep :3000`
- 数据目录权限: `chown -R 1000:1000 data/`
- 环境变量缺失: 检查 `.env.testnet`

### P2P 连接失败

**症状**: `/network/peers` 返回空

**检查**:
1. 确认种子节点可达: `telnet seed.testnet.digitalchain.org 30001`
2. 检查防火墙: `sudo ufw status`
3. 查看节点日志: `docker logs dc-node2 | grep P2P`

### 水龙头余额不足

**症状**: 调用 `/claim` 返回 `Faucet balance too low`

**解决**:
1. 向水龙头地址转账测试代币
2. 或修改 `FAUCET_AMOUNT` 降低每次发放金额

```bash
# 向水龙头充值（从其他钱包）
curl -X POST http://localhost:3000/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0x你的矿工地址",
    "to": "0xFaucetWalletAddress...",
    "amount": 10000,
    "privateKey": "你的私钥"
  }'
```

### 交易卡在 pending

**可能原因**:
- 余额不足
- nonce 冲突
- 交易池已满（默认无限制，但可能内存不足）

**解决**:
1. 重启节点（会清空 pending 池）
2. 检查余额: `curl http://localhost:3000/balance/地址`
3. 查看 pending: `curl http://localhost:3000/pending | jq`

---

## 📞 获取帮助

- **GitHub Issues**: https://github.com/skycn1983/digital-chain/issues
- **Discord**: https://discord.gg/digital-chain
- **文档**: https://docs.digitalchain.org

---

**祝部署顺利！如有问题，欢迎提交 Issue 或加入社区讨论。** 🚀

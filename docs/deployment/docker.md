# Docker 部署指南

本指南说明如何使用 Docker 部署 Digital Chain 节点。

## 前提条件

- Docker 20.10+
- Docker Compose 2.0+ (可选，用于编排)

## 方式 1: 直接使用 Dockerfile

### 构建镜像

```bash
cd digital-chain
docker build -t digital-chain:latest .
```

### 运行容器

```bash
docker run -d \
  --name digital-chain \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e PORT=3000 \
  -e DIFFICULTY=2 \
  -e BLOCK_REWARD=50 \
  digital-chain:latest
```

**参数说明**:
- `-d`: 后台运行
- `-p 3000:3000`: 映射端口（宿主机:容器）
- `-v $(pwd)/data:/app/data`: 持久化链数据
- `-e`: 环境变量（可选）

### 查看日志

```bash
docker logs -f digital-chain
```

### 停止容器

```bash
docker stop digital-chain
docker rm digital-chain
```

## 方式 2: 使用 Docker Compose (推荐)

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  digital-chain:
    build: .
    container_name: digital-chain
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - DIFFICULTY=2
      - BLOCK_REWARD=50
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health')"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
```

### 启动

```bash
docker-compose up -d
```

### 查看状态

```bash
docker-compose ps
docker-compose logs -f
```

### 停止

```bash
docker-compose down
# 保留数据卷
docker-compose down -v  # 删除数据卷（⚠️ 会清除链数据）
```

## 配置说明

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 服务器监听端口 |
| DIFFICULTY | 2 | 初始挖矿难度（前导零数量） |
| BLOCK_REWARD | 50 | 出块奖励（OCT） |

### 数据持久化

链数据保存在容器内的 `/app/data/chain.json`。

**重要**: 必须挂载宿主机目录到 `/app/data`，否则容器重启后数据丢失。

```bash
# 宿主机数据目录
./data/
  chain.json  # 链状态、区块、交易池
```

### 多节点部署

如需运行多个节点（测试网络），修改端口映射：

```yaml
services:
  node1:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./node1/data:/app/data

  node2:
    build: .
    ports:
      - "3001:3000"  # 宿主机3001 → 容器3000
    volumes:
      - ./node2/data:/app/data
    environment:
      - PORT=3000  # 容器内仍为3000
```

## 生产环境建议

### 1. 网络安全

- 使用反向代理（Nginx/Traefik）并配置 TLS
- 限制 API 访问 IP（如需）
- 配置防火墙只开放必要端口

### 2. 性能优化

- 增加容器资源限制：
  ```yaml
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 1G
  ```
- 使用 SSD 存储数据卷
- 调整难度参数以匹配硬件性能

### 3. 监控

- 使用 Docker 健康检查（已内置）
- 配置 Prometheus + Grafana 监控容器指标
- 日志收集到 ELK/Loki

### 4. 备份

定期备份 `data/chain.json`:

```bash
# 手动备份
cp data/chain.json backup/chain-$(date +%Y%m%d-%H%M%S).json

# 自动备份（cron）
0 2 * * * cp /path/to/digital-chain/data/chain.json /backup/
```

### 5. 高可用（TODO）

当前为单节点，生产环境需要：
- 多个节点 + 负载均衡
- P2P 网络层实现
- 数据同步机制

## 故障排除

### 容器启动失败

```bash
# 查看详细日志
docker logs digital-chain

# 常见问题：
# - 端口已被占用：修改主机端口映射
# - 权限错误：确保 data/ 目录可写
```

### 数据丢失

如果忘记挂载数据卷，容器重启后链从创世块开始。需要从备份恢复 `chain.json`。

### WebSocket 无法连接

- 确认端口映射正确：`docker ps` 查看端口
- 检查防火墙：WebSocket 使用 HTTP 升级，与 HTTP 同端口
- 查看容器日志：`docker logs digital-chain`

## 升级镜像

```bash
# 1. 拉取或重建最新镜像
docker build -t digital-chain:latest .

# 2. 停止旧容器（保留数据卷）
docker-compose down

# 3. 启动新容器
docker-compose up -d

# 或直接重启（保留数据卷）
docker-compose restart
```

---

**下一步**: 阅读 [生产部署最佳实践](./production.md)（TODO）

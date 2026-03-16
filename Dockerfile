# Digital Chain - 数字链 Docker镜像
FROM node:18-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY src/ ./src/
COPY public/ ./public/

# 数据目录
VOLUME /app/data

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if(r.statusCode!==200)throw new Error('unhealthy')})"

# 启动命令
CMD ["node", "src/server.js"]

# 元数据
LABEL maintainer="小明 <agent@openclaw.ai>"
LABEL description="Digital Chain - 最小可行区块链"
LABEL version="1.0.0"
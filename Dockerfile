# Digital Chain Node Docker Image
FROM node:18-alpine

# 安装依赖（如果需要原生模块）
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && ln -sf /usr/bin/python3 /usr/bin/python

# 工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源码
COPY . .

# 构建（如果需要）
RUN npm run build || true

# 暴露端口
EXPOSE 3000 30001

# 健康检查
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if(r.statusCode!==200)throw new Error(r.statusCode)})"

# 启动命令
CMD ["node", "src/server.js"]

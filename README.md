# Agent Browser OpenAPI 工具

生产级 Agent Browser 服务，可直接导入 Open WebUI。

## ✨ 特性

- ✅ **请求队列**：防止并发冲突
- ✅ **Session 管理**：自动清理资源
- ✅ **重试机制**：指数退避（最多 2 次）
- ✅ **智能等待**：使用 `networkidle` 而非固定延迟
- ✅ **安全执行**：防止 Shell 注入
- ✅ **详细日志**：便于调试
- ✅ **错误处理**：完善的异常捕获

## 🚀 快速开始

### 1. 安装依赖

```bash
cd mytools/agent-browser
npm install
npm install -g agent-browser
```

### 2. 启动服务

```bash
npm start
```

输出：
```
🚀 Agent Browser OpenAPI Server running on http://localhost:5000
📋 OpenAPI Spec: http://localhost:5000/openapi.json

✨ Features:
   ✅ Request queuing (prevents conflicts)
   ✅ Session management (proper cleanup)
   ✅ Retry mechanism (2 retries with backoff)
   ✅ Network idle waiting (proper page load)
   ✅ Safe command execution (no shell injection)
```

### 3. 在 Open WebUI 中导入

1. 打开 Open WebUI
2. 进入 **Workspace** → **Tools**
3. 点击 **Import Tool**
4. 输入 URL：
   - 本地：`http://localhost:5000/openapi.json`
   - Docker：`http://host.docker.internal:5000/openapi.json`

## 📋 可用功能

导入后自动生成 3 个工具：

### searchWeb(query, maxResults)
搜索网页并返回结果

### browseUrl(url, selector, extract)
浏览并提取网页内容

### getScreenshot(url)
获取网页截图（base64）

## 🧪 测试

```bash
# 健康检查
curl http://localhost:5000/health

# 搜索测试
curl -X POST http://localhost:5000/search \
  -H "Content-Type: application/json" \
  -d '{"query":"OpenAI","maxResults":3}'
```

## 🔧 使用 PM2 保持运行

```bash
npm install -g pm2
pm2 start openapi-server.js --name agent-browser
pm2 save
pm2 startup
```

## 📊 监控

访问 `/health` 查看状态：
```json
{
  "status": "ok",
  "service": "agent-browser-openapi",
  "version": "1.0.0",
  "queue": 0
}
```

## ⚙️ 环境变量

```bash
PORT=5000  # 自定义端口
```

## 🛡️ 生产部署建议

1. **使用 HTTPS**：配置反向代理（Nginx/Caddy）
2. **添加认证**：API Key 或 JWT
3. **限流**：使用 `express-rate-limit`
4. **日志**：集成 Winston 或 Pino
5. **监控**：Prometheus + Grafana

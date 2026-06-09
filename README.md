# AI Proxy

本地代理服务器，让 Claude 桌面端能够接入第三方大模型（DeepSeek、MiMo 等）。

## 功能特性

- 支持 DeepSeek、小米 MiMo 等第三方大模型
- 插件式架构，易于扩展新模型
- 支持流式响应（streaming）
- 完整的 Claude Messages API 兼容
- 自动模型名映射

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填入你的 API Key：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# ============================================================
# API Keys - 请填入你自己的 API Key
# ============================================================

# DeepSeek API Key
# 获取地址: https://platform.deepseek.com/api_keys
# 1. 注册/登录 DeepSeek 开放平台
# 2. 进入 "API Keys" 页面
# 3. 点击 "创建 API Key"
# 4. 复制 sk- 开头的密钥粘贴到下面
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 小米 MiMo API Key
# 获取地址: https://mimo.xiaomi.com/
# 1. 注册/登录小米大模型平台
# 2. 进入 API 管理页面
# 3. 创建新的 API Key
# 4. 复制粘贴到下面
MIMO_API_KEY=your-mimo-api-key

# OpenAI 兼容接口（可选，如 GPT-4、Claude 等）
OPENAI_COMPAT_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_COMPAT_BASE_URL=https://api.openai.com/v1
OPENAI_COMPAT_MODEL=gpt-4

# ============================================================
# 服务器配置
# ============================================================
PORT=3000
HOST=0.0.0.0

# ============================================================
# 日志配置
# ============================================================
LOG_LEVEL=info
LOG_TO_FILE=true
LOG_DIR=./logs
```

> ⚠️ **注意**: `.env` 文件包含敏感信息，不要提交到 Git！

### 3. 启动代理服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

### 4. 配置 Claude Desktop

编辑 Claude Desktop 配置文件：

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

添加环境变量：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:3000"
  }
}
```

重启 Claude Desktop。

### 5. 使用

在 Claude Desktop 中选择模型：

- `claude-3-5-sonnet-20241022` → 自动路由到 DeepSeek
- `claude-3-opus-20240229` → 自动路由到 DeepSeek Reasoner

## 添加新模型

1. 在 `plugins/` 目录下创建新插件目录
2. 实现 `AIPlugin` 接口或继承 `BasePlugin`
3. 在 `config/models.yaml` 中添加配置
4. 重启代理服务器

## 开发

### 运行测试

```bash
npm test
```

### 构建

```bash
npm run build
```

### 启动生产版本

```bash
npm start
```

## 配置说明

### models.yaml

```yaml
server:
  port: 3000
  host: localhost

logging:
  level: info
  console: true
  file: true
  logDir: ./logs

plugins:
  deepseek:
    enabled: true
    baseUrl: https://api.deepseek.com/v1
    apiKey: ${DEEPSEEK_API_KEY}
    models:
      - claudeModel: claude-3-5-sonnet-20241022
        actualModel: deepseek-chat
        supportsStreaming: true
```

## 许可证

MIT

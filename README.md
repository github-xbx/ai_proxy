# AI Proxy

本地代理服务器，让 Claude 桌面端能够接入第三方大模型（DeepSeek、MiMo 等）。

## 功能特性

- 支持 DeepSeek、小米 MiMo 等第三方大模型
- 路由式架构，通过 `models.yaml` 配置模型映射，易于扩展
- 支持两种后端协议：**Anthropic 兼容**（直通）和 **OpenAI 兼容**（自动格式转换）
- 支持流式响应（SSE streaming）
- 完整的 Claude Messages API 兼容
- 支持打包为单文件可执行程序（SEA）和 Windows 安装包

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

编辑 `.env` 文件，按需填写：

```env
# DeepSeek API Key（https://platform.deepseek.com/api_keys）
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 小米 MiMo API Key（https://mimo.xiaomi.com/）
MIMO_API_KEY=your-mimo-api-key

# 服务器配置
PORT=3000
HOST=localhost

# 日志配置
LOG_LEVEL=info
LOG_TO_FILE=true
LOG_DIR=./logs
```

> ⚠️ `.env` 文件包含敏感信息，不要提交到 Git！

### 3. 配置模型路由

编辑 `config/models.yaml`，添加或修改模型路由：

```yaml
server:
  port: 3000
  host: localhost

logging:
  level: info
  console: true
  file: true
  logDir: ./logs
  filePattern: ai-proxy-%DATE%.log
  retentionDays: 7

routes:
  # Claude 模型名 -> 后端路由配置
  claude-sonnet-4-5:
    targetModel: deepseek-v4-pro[1m]     # 实际发送给后端的模型名
    protocol: anthropic                    # anthropic 直通 / openai 需格式转换
    baseUrl: https://api.deepseek.com/anthropic
    apiKey: ${DEEPSEEK_API_KEY}
    streaming: true

  claude-sonnet-4-6:
    targetModel: mimo-v2.5-pro
    protocol: anthropic
    baseUrl: https://token-plan-cn.xiaomimimo.com/anthropic
    apiKey: ${MIMO_API_KEY}
    streaming: true
```

### 4. 启动代理服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

### 5. 配置 Claude Desktop

编辑 Claude Desktop 配置文件：

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

添加环境变量：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:3000"
  }
}
```

重启 Claude Desktop，选择模型即可自动路由到对应后端。

## 路由配置说明

在 `config/models.yaml` 的 `routes` 中，每个 key 是 Claude 模型名，value 包含：

| 字段 | 说明 |
| ---- | ---- |
| `targetModel` | 发送给后端 API 的实际模型名 |
| `protocol` | `anthropic`（直通）或 `openai`（自动格式转换） |
| `baseUrl` | 后端 API 基础地址 |
| `apiKey` | API 密钥，支持 `${ENV_VAR}` 引用环境变量 |
| `streaming` | 是否支持流式响应，默认 `true` |

**Anthropic 协议**适用于 DeepSeek、MiMo 等原生支持 Anthropic 格式的后端，代理仅替换模型名，其余直通。

**OpenAI 协议**适用于 GPT-4 等 OpenAI 兼容接口，代理自动完成 Claude ↔ OpenAI 格式转换。

## 添加新模型

在 `config/models.yaml` 的 `routes` 中添加一条即可：

```yaml
routes:
  # 已有路由 ...
  claude-3-5-haiku-20241022:              # Claude 模型名（Claude Desktop 中选择的名称）
    targetModel: your-target-model        # 后端实际模型名
    protocol: openai                      # anthropic 或 openai
    baseUrl: https://your-api.com/v1
    apiKey: ${YOUR_API_KEY}
    streaming: true
```

重启服务器生效。

## 开发

```bash
# 开发模式运行
npm run dev

# TypeScript 编译
npm run build

# 运行测试
npm test

# 启动生产版本
npm start

# 仅校验配置（不启动服务）
npm run dev -- --validate-only
```

## 打包发布

### 打包为单文件可执行程序（SEA）

```bash
npm run build-sea
```

输出到 `release/exe/ai-proxy.exe`，连同 `config/` 目录和启动脚本一起复制。只需将 `.env` 放到 exe 同目录即可运行。

### 打包为 Windows 安装包

```bash
npm run build-installer
```

使用 NSIS 打包，输出到 `release/installer/`。

## 项目结构

```text
ai-proxy/
├── config/
│   └── models.yaml          # 路由配置文件
├── src/
│   ├── index.ts              # 入口：加载配置、校验、启动服务
│   ├── server.ts             # Express HTTP 服务器
│   ├── router.ts             # 路由匹配（根据 model 名查找配置）
│   ├── transformer.ts        # 请求/响应格式转换（Anthropic ↔ OpenAI）
│   ├── config.ts             # 配置管理器（读取 YAML、解析环境变量）
│   ├── types.ts              # TypeScript 类型定义
│   └── utils/
│       └── logger.ts         # 日志工具
├── scripts/
│   ├── build-sea.js          # SEA 单文件打包脚本
│   ├── ai-proxy-start.bat    # Windows 启动脚本
│   └── ai-proxy-stop.bat     # Windows 停止脚本
├── installer/
│   └── ai-proxy.nsi          # NSIS 安装包脚本
└── .env.example              # 环境变量模板
```

## 许可证

MIT

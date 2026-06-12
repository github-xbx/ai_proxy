========================================
  AI Proxy - 快速开始指南
========================================

AI Proxy 是一个本地代理服务器，让 Claude Desktop 可以使用
第三方 AI 模型（DeepSeek、MiMo、OpenAI 兼容等）。


1. 配置 API 密钥
----------------------------------------

编辑安装目录下的 .env 文件，填入你的 API Key：

  DEEPSEEK_API_KEY=sk-你的deepseek密钥
  MIMO_API_KEY=你的mimo密钥


2. 配置模型路由
----------------------------------------

编辑 config\models.yaml 文件，添加或修改模型路由。

每个路由将一个 Claude 模型名映射到后端 API：

  routes:
    claude-sonnet-4-5:
      targetModel: deepseek-v4-pro[1m]
      protocol: anthropic
      baseUrl: https://api.deepseek.com/anthropic
      apiKey: ${DEEPSEEK_API_KEY}
      streaming: true

字段说明：
  - claudeModel:  Claude Desktop 使用的模型名（路由键名）
  - targetModel:  实际发送给后端 API 的模型名
  - protocol:     协议类型
                  "anthropic" - 直通模式，适用于 DeepSeek、MiMo 等
                  "openai"    - 格式转换，适用于 OpenAI 兼容 API
  - baseUrl:      后端 API 基础地址
  - apiKey:       API 密钥（支持 ${环境变量名} 语法）
  - streaming:    是否启用流式响应（true/false）


3. 配置 Claude Desktop
----------------------------------------

在 Claude Desktop 设置中，将 API 地址改为：

  ANTHROPIC_BASE_URL=http://localhost:3000

然后选择与路由配置中对应的模型名即可。


4. 启动 / 停止
----------------------------------------

启动：双击桌面或开始菜单中的 "AI Proxy" 快捷方式
停止：任务管理器 > node.exe > 结束任务


5. 支持的协议
----------------------------------------

  anthropic  直通模式
             适用于原生支持 Anthropic 协议的 API
             （DeepSeek、MiMo 等）
             仅替换模型名，不做格式转换

  openai     转换模式
             适用于 OpenAI chat/completions 兼容 API
             （GPT 等）
             自动完成请求/响应格式转换

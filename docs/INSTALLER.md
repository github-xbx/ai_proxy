# AI Proxy 安装程序制作

使用 NSIS 制作 Windows 安装程序。

## 前置要求

1. **NSIS** - 下载安装 https://nsis.sourceforge.io/Download
2. **Node.js** - 已安装
3. **esbuild** - `npm install --save-dev esbuild`

## 制作安装程序

```bash
npm run build-installer
```

或者手动：

```bash
scripts\build-installer.bat
```

## 输出

生成 `ai-proxy-setup.exe` 安装程序，包含：
- Node.js 运行时（无需用户单独安装）
- AI Proxy 应用程序
- 配置文件和插件
- 桌面和开始菜单快捷方式

## 安装程序功能

- ✅ 安装向导界面
- ✅ 选择安装目录
- ✅ 创建桌面快捷方式
- ✅ 创建开始菜单
- ✅ 添加 Windows 防火墙规则
- ✅ 注册卸载程序
- ✅ 支持中文界面

## 文件结构

```
installer/
├── ai-proxy.nsi     # NSIS 脚本
├── LICENSE.txt      # 许可证
└── build/           # 构建临时目录
    ├── node/        # Node.js 运行时
    └── app/         # 应用程序文件
```

## 自定义

### 修改图标

将 `ai-proxy.ico` 放到项目根目录。

### 修改安装选项

编辑 `installer/ai-proxy.nsi` 文件。

## 卸载

用户可以通过以下方式卸载：
- 控制面板 -> 程序和功能
- 开始菜单 -> AI Proxy -> Uninstall
- 安装目录 -> uninstall.exe

<div align="center">
  <img width="100%" src="https://erika.snowy.moe/v1/banner/Moemu/Erika.webp" alt="Erika Banner" />
  <h1>Erika（絵里香）</h1>
  <i>A banner girl who paints portraits for your repos.</i>
</div>

<p align="center">
  <a href="https://github.com/Moemu/Erika/stargazers"><img src="https://img.shields.io/github/stars/Moemu/Erika" alt="Stars" /></a>
  <a href="https://github.com/Moemu/Erika/actions/workflows/ci.yml"><img src="https://github.com/Moemu/Erika/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
</p>

<p align="center">
  <a href="https://erika.snowy.moe/">🎨 在线预览</a> ·
  <a href="#快速开始">🚀 快速开始</a> ·
  <a href="#部署">📦 部署指南</a> ·
  <a href="#api">📖 API</a>
</p>

## 简介✨

Erika 是一个为 GitHub 仓库生成 Banner 的服务。她把项目插画、名称、描述和星标等信息排成一张图片，让你通过一个 URL 把项目介绍放进 README。

你可以使用自己的插画、GitHub 头像，或直接使用 Erika 的内置插画。在 Playground 中调整样式后，复制 Markdown 即可嵌入。也可以通过 GitHub Actions 定时生成图片，直接保存到仓库。

## 功能🪄

- **仓库信息**：读取公开仓库的名称、描述、星标、Fork 数、开放的 Issue / PR 数和最新 Release。
- **插画与头像**：支持仓库内的图片、GitHub 头像和内置插画，提供两种排版模板。
- **文字排版**：支持中英文、自动换行、字号适配和长文本省略。
- **外观调整**：支持亮暗主题、图标裁切、圆形遮罩，以及 WebP / PNG 输出。
- **在线预览**：通过 URL 分享配置，复制 Markdown、双主题 `<picture>` 或图片链接。
- **部署选择**：支持 Vercel、Docker，以及无需常驻服务的 GitHub Actions。

## 快速开始🚀

打开 [Playground](https://erika.snowy.moe/)，填写仓库的 Owner 和 Repo，调整图标、文字及主题，然后复制页面生成的 Markdown。

也可以直接把下面的内容放进 README，将 `Moemu/Erika` 替换为你的公开仓库：

```markdown
![项目 Banner](https://erika.snowy.moe/v1/banner/Moemu/Erika.webp)
```

如果使用自己部署的服务，将域名替换为你的服务地址即可。

<details>
<summary>跟随 GitHub 的亮暗主题</summary>

使用 `<picture>` 为两种主题分别指定图片：

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://erika.snowy.moe/v1/banner/Moemu/Erika.webp?theme=dark" />
  <source media="(prefers-color-scheme: light)" srcset="https://erika.snowy.moe/v1/banner/Moemu/Erika.webp?theme=light" />
  <img alt="项目 Banner" src="https://erika.snowy.moe/v1/banner/Moemu/Erika.webp" />
</picture>
```

> **注意**：显式指定 `theme` 会关闭插画的背景融合，图标自带的底色会直接显示，与主题底色可能冲突、观感突兀。
> 需要融合效果时请省略 `theme`（单 URL）。主题化与插画背景的兼容仍在计划中。

</details>

## 自定义⚙️

### 项目图标

默认会从目标仓库的默认分支中，依次查找以下文件。找不到可用图片时，使用 Erika 的内置插画：

```text
assets/grokbot-icon.webp
assets/grokbot-icon.png
assets/grokbot-icon.jpg
```

通过查询参数可以更换来源或显示方式：

| 用法 | 效果 |
| --- | --- |
| `?iconPath=assets/my-icon.webp` | 使用目标仓库内的指定图片 |
| `?icon=avatar` | 使用仓库所属用户或组织的 GitHub 头像 |
| `?icon=builtin` | 使用 Erika 的内置插画 |
| `?icon=avatar&iconFit=cover&iconRound=1` | 使用填满图标区域的圆形头像 |

`iconPath` 接受仓库内的相对路径。多个参数用 `&` 连接。

### 排版模板

| 模板 | 适合的图片 | 排版方式 |
| --- | --- | --- |
| `grokbot` | 带背景留白的项目插画 | 尝试让插画背景与 Banner 底色融合 |
| `avatar` | 普通头像或 Logo | 将图片放入独立区域，与文字保持间距 |

默认使用 `grokbot`；设置 `icon=avatar` 时自动使用 `avatar`。也可以在 URL 中指定模板：

```text
https://erika.snowy.moe/v1/banner/Moemu/Erika/avatar.webp?icon=avatar
```

### 文字与仓库信息

标题和描述默认来自 GitHub，可用 `title`、`description` 覆盖。URL 中的空格、中文及特殊字符需要编码，推荐在 Playground 中填写后复制链接。

`meta` 控制显示哪些仓库信息。例如，只保留星标和最新 Release：

```text
https://erika.snowy.moe/v1/banner/Moemu/Erika.webp?meta=stars,release
```

省略 `meta` 使用模板默认字段；写成 `?meta=` 则隐藏全部仓库信息字段。

描述里可以用 `**…**` 标记一段强调文字：成对出现时该段用主题的强调色绘制，标记本身不参与排版度量（不占宽度、不影响换行与自动缩排）；落单的 `**` 按字面输出。例如 `?description=An **event-loop** chatbot`。

## 部署📦

| 方式 | 适合的场景 | 运行方式 |
| --- | --- | --- |
| Vercel | 希望直接获得在线预览和动态 API | 前端静态托管，API 由函数运行 |
| GitHub Actions | 只需要 README 图片，不想维护在线服务 | 定时生成图片并提交到仓库 |
| Docker | 已有容器运行环境，需要自行管理服务 | 同一个容器提供 Playground 和 API |

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FMoemu%2FErika&project-name=erika&env=GITHUB_TOKEN)

1. 使用上方按钮部署，或 Fork 后在 Vercel 导入仓库。
2. 将项目根目录设为仓库根目录，保留仓库中的构建配置。
3. 配置 `GITHUB_TOKEN`，使用只读公开仓库的令牌。
4. 部署完成后，打开站点首页预览，或访问 `/v1/banner/:owner/:repo.webp`。

### GitHub Actions

1. 将 [工作流示例](docs/examples/refresh-banner.yml) 复制到你仓库的 `.github/workflows/refresh-banner.yml`。
2. 修改 `BANNER_OWNER`、`BANNER_REPO`、`BANNER_TEMPLATE` 和 `BANNER_OUT`。
3. 在仓库的 Actions 页面启用工作流，并手动运行一次。
4. 在 README 中引用生成的文件，例如 `![项目 Banner](assets/banner.webp)`。

示例每小时运行一次，图片没有变化时不会产生提交。工作流使用 GitHub 自动提供的 `GITHUB_TOKEN`，并需要 `contents: write` 权限来提交图片。

`ERIKA_REF` 默认跟随 `main`。需要固定工具版本时，将其改为已验证的提交 SHA 或发布标签。定时任务可能延迟，图片更新以任务实际完成时间为准。

### Docker

克隆仓库，复制环境变量示例，并在 `.env` 中填写 `GITHUB_TOKEN`：

```bash
git clone https://github.com/Moemu/Erika.git
cd Erika
cp .env.example .env
```

构建并启动服务：

```bash
docker build -t erika:local .
docker run -d --name erika -p 8787:8787 --env-file .env erika:local
```

打开 `http://localhost:8787` 即可使用 Playground，API 使用同一地址。

需要自定义项目预设时，在构建镜像前编辑 [预设配置](apps/api/presets/presets.json)，或将包含 `presets.json` 的目录只读挂载到容器的 `/app/apps/api/presets`。预设在启动时读取，修改挂载文件后需要重启容器。

## API

以下路径相对于你的服务地址：

| 请求 | 用途 |
| --- | --- |
| `GET /v1/banner/:owner/:repo.webp` | 生成 WebP Banner；扩展名可改为 `.png` |
| `GET /v1/banner/:owner/:repo/:template.webp` | 使用指定模板生成 Banner |
| `GET /v1/meta` | 查询模板、主题、支持的字段和参数限制 |
| `GET /doc` | 获取 OpenAPI 描述 |
| `GET /healthz` | 检查服务状态 |

### 查询参数

| 参数 | 说明 |
| --- | --- |
| `theme` | `light` / `dark`；省略时根据插画背景自动配色（推荐）；显式指定会关闭背景融合，图标自带底色直接显示 |
| `icon` | `auto` / `avatar` / `builtin`，默认 `auto` |
| `iconPath` | 仓库内的图片相对路径，最长 128 个字符 |
| `iconFit` | `contain` 保留完整图片，`cover` 填满区域并裁切 |
| `iconRound` | `1` 启用圆形遮罩，`0` 关闭 |
| `title` | 覆盖标题，最长 25 个字符（版式在该长度下仍完整显示） |
| `description` | 覆盖描述，最长 180 个字符（超出 0.75 倍下限的排版容量会截断） |
| `meta` | 逗号分隔的字段：`full_name`、`stars`、`forks`、`issues`、`release`；需由所选模板支持 |
| `scale` | 缩放比例，范围为 0.1～1；默认 0.5，输出 1500 × 900 图片 |
| `lang` | 错误占位图语言，`en` / `zh`，默认 `en` |
| `fresh` | `fresh=1` 让响应使用 `Cache-Control: no-cache`，便于检查源站响应 |

### 缓存与错误处理

图片响应带有 `ETag` 和 `Cache-Control`，客户端可使用条件请求复用图片。仓库数据和图片均有缓存，星标变化不会立刻反映到所有客户端。GitHub README 还会经过 Camo 图片代理，其刷新时间可能晚于源站。

仓库不存在或为私有时，API 返回错误占位图，并通过 `X-Banner-Error` 说明原因。GitHub 暂时不可用时，服务优先使用有效期内的旧数据；没有可用数据时返回占位图。参数错误返回 `400`，服务繁忙可能返回 `503`。

## 本地开发🛠️

需要 Node.js 22 或更新版本，以及项目 `packageManager` 字段指定的 pnpm。

```bash
git clone https://github.com/Moemu/Erika.git
cd Erika
pnpm install
pnpm build
cp .env.example .env
```

在 `.env` 中填写 `GITHUB_TOKEN`。本项目只读取公开仓库，令牌只需公开信息的读取权限；classic PAT 可不勾选 scope，细粒度令牌可使用公开仓库只读访问。具体权限见 [GitHub 文档](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)。

分别在两个终端启动 API 和 Playground：

```bash
pnpm dev:api
```

```bash
pnpm --filter @erika/playground dev
```

Playground 地址为 `http://localhost:5173`，API 地址为 `http://localhost:8787`。开发预览页会将 API 请求转发到后端。

### 命令行出图

在仓库根目录运行以下命令，读取 GitHub 数据并保存图片：

```bash
node packages/cli/dist/cli.js render-live --owner Moemu --repo Erika --out out/banner.webp
```

也可以直接渲染 Erika 自己的 Banner，输出位于 `out/`：

```bash
pnpm render:erika
```

### 修改与验证

```bash
pnpm build
pnpm test
pnpm typecheck:vercel
```

`pnpm test` 包含单元测试、接口测试和视觉回归。新增模板可从 [模板目录](packages/templates/) 开始；API 位于 `apps/api`，预览页位于 `apps/playground`，渲染器位于 `packages/core`，GitHub 数据访问位于 `packages/providers`。

如果需要从 PSD 提取图层和文字样式，参考 [PSD 工具说明](packages/psd-toolkit/README.md)。

## 关于🎗️

Erika（絵里香）是一位为仓库绘制肖像的画师少女。项目从手工排版的 PSD 封面图出发，把一张张手工做的介绍图变成可通过 URL 配置、随仓库数据变化的服务。

感谢以下项目与资源：

- [Shields.io](https://shields.io/)：以 URL 配置图片的使用方式。
- [Grokbot Icon Studio](https://grokbot-icon-studio.serio-ai.chatgpt.site/zh-hans)：内置插画的提示词来源。本项目仅引用链接，不收录提示词。
- [Hono](https://hono.dev/) 与 [Canvas](https://github.com/Brooooooklyn/canvas)：API 服务与图片渲染。

代码、文档及模板配置采用 [MIT](LICENSE) 许可证，再分发时请保留许可声明。

内置插画由 OpenAI GPT-Image-2.5 生成，项目实际持有且有权授权的权利按 MIT 提供。字体遵循各自附带的 OFL 许可；使用自备图片或字体时，请确认相应授权。完整范围及责任说明见 [素材许可说明](ASSET-LICENSE.md)。

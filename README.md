# Erika（絵里香）

> 为你的仓库绘制肖像的画师少女 / A banner girl who paints portraits for your repos

shields.io 风格的项目 Banner 生成服务。访问一个 URL，自动拉取 GitHub 仓库名称、星标数等信息，按模板渲染出 Banner 图片。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FMoemu%2FErika&project-name=erika&env=GITHUB_TOKEN)

**当前进度：M4（部署与文档）** · 设计文档见 [docs/design.md](docs/design.md) · 渲染验收见 [docs/acceptance.md](docs/acceptance.md)

```text
erika/
├─ apps/                      # api（服务 + 同源静态托管）、playground（调参前端）
├─ packages/
│  ├─ core/                   # 布局计算 + 渲染引擎（@napi-rs/canvas，纯函数）
│  ├─ templates/              # grokbot / avatar 模板（比例版式）、字体、默认图标资产
│  ├─ providers/              # DataProvider（GitHub，ETag 条件请求 + SWR）
│  ├─ shared/                 # 类型与参数 schema（api/playground 共用）
│  └─ psd-toolkit/            # PSD → 模板 提取器（Python，开发期工具）
├─ api/                       # Vercel Function 入口（路线 A）
└─ docs/
```

## 三种部署路线

| 路线 | 前端 | 图片生成 | 你需要准备 |
|------|------|----------|------------|
| **A. Vercel 一键部署（推荐）** | Vercel 静态 CDN | Vercel Node Function | 平台账号、仓库副本、GitHub Token |
| **B. Docker 自托管** | 容器内同源托管 | Node 容器 | 可运行 Docker 的环境 |
| **C. GitHub Actions 定时生成** | 不需要（Banner 为仓库内静态文件） | 工作流调用 `erika render-live` CLI | 仓库与工作流配置 |

### 路线 A：Vercel 一键部署

1. Fork 本仓库（或直接用上方 Deploy 按钮）；
2. 在 Vercel 项目设置中配置 `GITHUB_TOKEN` 环境变量；
3. 访问 `https://<your-app>.vercel.app/v1/banner/:owner/:repo.webp`。

### 路线 B：Docker 自托管

```bash
docker build -t erika .
docker run -d -p 8787:8787 \
  -e GITHUB_TOKEN=ghp_xxx \
  -v ./presets:/app/apps/api/presets \
  erika:local
```

镜像内 Playground 与 API **同源托管**在 `http://localhost:8787`；`./presets`
卷挂载可热替换项目预设。也发布了预构建镜像：`ghcr.io/moemu/erika`（main 分支
与 tag 自动构建）。

### 路线 C：GitHub Actions 定时生成

把 [`docs/examples/refresh-banner.yml`](docs/examples/refresh-banner.yml) 复制到
你仓库的 `.github/workflows/` 下，改三个环境变量即可：定时调用 `erika
render-live` 重新渲染 Banner 并提交到你的仓库——**不需要任何托管服务**，
星标新鲜度 = cron 粒度；文件无变化时不产生提交。

## 快速上手（本地开发）

```bash
# 1. 构建与测试（Node ≥ 22 + pnpm）
pnpm install && pnpm build && pnpm test

# 2. 渲染样例（使用 PSD 提取的数据快照；--icon 离线指定图标）
pnpm render:mas
pnpm render:rikka
# 输出在 out/ 下

# 3. 启动 API 服务
pnpm dev:api
# GET http://localhost:8787/v1/banner/Moemu/Muika-After-Story.webp
# 生产环境必须配置 GITHUB_TOKEN（未认证配额仅 60 req/h，见设计文档 6.2 节）

# 4. Playground
pnpm --filter @erika/playground dev
# 打开 http://localhost:5173 —— 参数面板由 /v1/meta 驱动，URL 即状态

# 5. 直接用 CLI 拉取真实 GitHub 数据渲染（路线 C：GitHub Actions 定时生成）
node packages/cli/dist/cli.js render-live --owner Moemu --repo Muika-After-Story --out banner.webp

# 6.（可选）从任意 PSD 重新提取模板数据
pip install -e packages/psd-toolkit
erika-psd extract <path/to/banner.psd> --out packages/templates/extracted/<name>
# 从多份参考 PSD 归纳比例版式（模板 layout 块的来源）
erika-psd induce <psd...> --out style-ratios.json
```

## API

```
GET /v1/banner/:owner/:repo(.webp|.png)           默认模板（按图标来源自动分流）
GET /v1/banner/:owner/:repo/:template(.webp|.png)  指定模板
GET /v1/meta                                       模板 / 主题 / 能力清单
GET /doc                                           OpenAPI 描述
GET /healthz                                       健康检查
```

常用查询参数（完整清单见 `/v1/meta` 的 `limits` 与各模板 `capabilities`）：

| 参数 | 说明 |
|------|------|
| `theme` | 亮/暗主题；**省略 = 自动**（捕获图标背景色作为画布底色，前景按亮度自适应） |
| `stats` | 元数据徽章字段（`stars` 等），模板需声明 `statsSlot` |
| `icon` | 图标来源：`preset` / `avatar` / `builtin` |
| `iconFit` / `iconRound` | 展示方式覆盖：contain / cover、圆形 / 方形 |
| `title` / `description` | 文案覆盖 |
| `meta` | 元数据字段覆盖（逗号分隔，`none` = 全部隐藏） |
| `scale` | 输出缩放（0.1–1，默认 0.5 = 1500×900） |
| `fresh` | 短缓存 + 强制回源验证 |

错误处理遵循 shields 惯例：仓库不存在或上游故障时返回**占位图**（`X-Banner-Error`
头携带原因），README 永不破图。响应带 `ETag` 与 `Cache-Control`（`s-maxage=3600`），
GitHub camo 按其缓存策略自动更新；需要立即刷新可加 `fresh=1`。

## 配置（GitHub Token）

生产**必须**配置 token：未认证配额只有 60 次/小时（按 IP），认证后 5000 次/小时，且带认证的 ETag 条件请求返回 304 时不计入主配额（设计文档 6.2 节）；权限只需读公开仓库（classic PAT 勾 `public_repo`，或细粒度 token 的 Public Repositories read-only）。

```bash
cp .env.example .env      # 填入 GITHUB_TOKEN
pnpm dev:api              # API / CLI 启动时读取仓库根的 .env；shell 里已设的同名变量优先
```

部署时按路线注入环境变量：Vercel 在项目设置 → Environment Variables；Docker 用 `-e GITHUB_TOKEN=…`；GitHub Actions 用内置的 `secrets.GITHUB_TOKEN`（示例见 `docs/examples/refresh-banner.yml`）。CLI 的 `render-live` 也读仓库根 `.env`，可用 `--token` 覆盖。

## 字体与资产

- 公开模板默认使用 OFL 授权字体（见 `packages/templates/fonts/` 及其 OFL 许可文件）。
- 若部署者自行持有商业字体（如 Torus SemiBold）许可，可通过 CLI `--fonts-dir` 在运行时从本地路径加载，该字体文件**不进入本仓库与镜像**。
- `packages/templates/assets` 中的插画与预设绑定的图标为项目自有资产。

## 许可

代码 BSD-3-Clause；`packages/templates/assets` 中的插画版权归 Moemu 所有，使用需授权。

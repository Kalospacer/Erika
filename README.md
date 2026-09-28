# Erika（絵里香）

> 为你的仓库绘制肖像的画师少女 / A banner girl who paints portraits for your repos

shields.io 风格的项目 Banner 生成服务。访问一个 URL，自动拉取 GitHub 仓库名称、星标数等信息，按模板渲染出 Banner 图片。

**当前进度：M3（Playground + 三路线部署）** · 设计文档见 [docs/design.md](docs/design.md)

```text
erika/
├─ apps/                      # api（M2）、playground（M3）
├─ packages/
│  ├─ core/                   # 布局计算 + 渲染引擎（@napi-rs/canvas，纯函数）+ erika CLI
│  ├─ templates/              # grokbot / avatar 模板（比例版式）、字体、默认图标资产
│  ├─ providers/              # DataProvider（M2：GitHub）
│  ├─ shared/                 # 类型与参数 schema（M2 起与 api/playground 共用）
│  └─ psd-toolkit/            # PSD → 模板 提取器（Python，开发期工具）
└─ docs/
```

## M1 快速上手

```bash
# 1. 构建与测试（Node ≥ 22 + pnpm）
pnpm install && pnpm build && pnpm test

# 2. 渲染样例（使用 PSD 提取的数据快照；--icon 离线指定图标）
pnpm render:mas
pnpm render:rikka
# 输出在 out/ 下

# 3. 启动 API 服务（M2）
pnpm dev:api
# GET http://localhost:8787/v1/banner/Moemu/Muika-After-Story.webp
# 生产环境必须配置 GITHUB_TOKEN（未认证配额仅 60 req/h，见设计文档 6.2 节）

# 4. Playground（M3）
pnpm --filter @erika/playground dev
# 打开 http://localhost:5173 —— 参数面板由 /v1/meta 驱动，URL 即状态

# 5. 直接用 CLI 拉取真实 GitHub 数据渲染（路线 C：GitHub Actions 定时生成）
node packages/cli/dist/cli.js render-live --owner Moemu --repo Muika-After-Story --out banner.webp

# 3.（可选）从任意 PSD 重新提取模板数据
pip install -e packages/psd-toolkit
erika-psd extract <path/to/banner.psd> --out packages/templates/extracted/<name>
# 从多份参考 PSD 归纳比例版式（模板 layout 块的来源）
erika-psd induce <psd...> --out style-ratios.json
```

## 配置（GitHub Token）

生产**必须**配置 token：未认证配额只有 60 次/小时（按 IP），认证后 5000 次/小时，且带认证的 ETag 条件请求返回 304 时不计入主配额（设计文档 6.2 节）；权限只需读公开仓库（classic PAT 勾 `public_repo`，或细粒度 token 的 Public Repositories read-only）。

```bash
cp .env.example .env      # 填入 GITHUB_TOKEN
pnpm dev:api              # API / CLI 启动时读取仓库根的 .env；shell 里已设的同名变量优先
```

部署时按路线注入环境变量：Vercel 在项目设置 → Environment Variables；Docker 用 `-e GITHUB_TOKEN=…`；GitHub Actions 用内置的 `secrets.GITHUB_TOKEN`（示例见 `docs/examples/refresh-banner.yml`）。CLI 的 `render-live` 也读仓库根 `.env`，可用 `--token` 覆盖。

## 字体说明

- 公开模板默认使用 OFL 授权字体（见 `packages/templates/fonts/` 及其 OFL 许可文件）。
- 若部署者自行持有商业字体（如 Torus SemiBold）许可，可通过 CLI `--fonts-dir` 在运行时从本地路径加载，该字体文件**不进入本仓库与镜像**。

# 素材许可说明

代码、文档及模板配置采用根目录的 [MIT 许可证](LICENSE)。本文件说明素材的来源、授权范围和责任边界。

## 内置插画

根据维护者提供的生成来源，默认插画使用 OpenAI GPT-Image-2.5 生成。透明版和表情变体使用内置 ImageGen 工具编辑，具体来源见下表：

| 文件 | 用途或来源 |
| --- | --- |
| `packages/templates/assets/erika.webp` | Erika 默认插画（模板内置图标） |
| `assets/erika-icon.webp` | Erika 仓库自身图标（Banner 左侧插画） |
| `packages/templates/assets/erika-transparent.png`、`assets/erika-icon-transparent.png` | 原插画经 ImageGen 移除背景得到的透明衍生图，用于亮暗主题 |
| `packages/templates/assets/erika-not-found.png` | 2026-10-02 使用内置 ImageGen 工具，以 Erika 透明插画为参考制作的冒汗表情变体，用于仓库不存在或已私有的占位图 |
| `apps/playground/public/icon-192.png`、`icon-512.png`、`favicon.ico`、`favicon-32.png`、`apple-touch-icon.png` | 应用图标，由同一张透明底原图导出 |

`tests/visual/baselines/erika-*.png`、`stranger-repo.png` 是上述插画的排版衍生图，沿用原素材的权利范围。
`tests/visual/baselines/not-found-*.png` 是仓库未找到插画的亮暗主题及中英文排版衍生图，沿用同一权利范围。
`tests/visual/baselines/avatar-zh-light.png` 使用测试脚本绘制的头像图形，按项目 MIT 许可证提供。

对于上述素材中 Moemu 实际持有且有权授权的权利，Moemu 按 [MIT](LICENSE) 授权。
授权包括商业和非商业使用、自托管、生成 Banner、修改及再分发，无须另行向 Moemu 申请许可。
分发素材或包含素材的产物时，应在随附文档、许可文件或对应发布页面保留 MIT 版权和许可声明；无需把声明绘制在图片上。

这项授权不授予第三方角色、参考图片、商标或其他第三方材料的权利。
AI 生成不意味着图片必然享有著作权、具有独占性，或已取得所有参考素材的授权。
对依法不受著作权保护的部分，本项目不主张新增专有权利。

### OpenAI 输出权利依据

核对日期：2026 年 9 月 28 日。

- [OpenAI 使用条款](https://openai.com/policies/terms-of-use/)的 Content 部分约定：在用户与 OpenAI 之间，并在法律允许的范围内，输出归用户所有；OpenAI 将其在输出中可能持有的权利转让给用户。
- [OpenAI 服务协议](https://openai.com/policies/services-agreement/)第 4 节对 API 等商业服务作出相应约定。
- [OpenAI 官方说明](https://help.openai.com/en/articles/6783457-what-is-chatgpt)允许在遵守适用条款和政策的前提下商业使用 ChatGPT 输出，包括再版和销售。
- [服务条款](https://openai.com/policies/service-terms/)以及生成时适用的账户协议仍须遵守。

这些条款说明 OpenAI 与生成用户之间的权利安排，不构成第三方权利清理证明。
本项目记录生成来源，但不据此声称每张图片均具有完整、排他的著作权。
样例文案或图标如提及第三方作品、角色或商标，本声明不授予该作品、角色或商标的权利。
各插画的完整参考素材及其授权尚未逐项核验，不能把本文件当作已完成该核验的证明。

### 提示词来源

来源：[Grokbot Icon Studio](https://grokbot-icon-studio.serio-ai.chatgpt.site/zh-hans)。
本项目仅提供来源及[上游许可页面](https://grokbot-icon-studio.serio-ai.chatgpt.site/zh-hans/license)的链接，不收录或分发提示词原文、翻译或修改版。
使用该网站提示词时，请自行遵守其许可；不收录提示词不豁免生成时使用提示词的义务。

## 字体与第三方依赖

`packages/templates/fonts/` 中的字体适用各自附带的 OFL 许可证，不改为 MIT。
第三方依赖保留各自许可证。部署者自行加载的商业字体须有相应使用授权。

## 用户提供的素材

用户通过本地文件、仓库路径、远程链接或其他方式指定的素材，以及服务获取的 GitHub 头像，均不因经过 Erika 处理而适用项目 MIT 许可证。
相关权利及使用条件由原权利人和适用协议决定。用户应确认获取、处理、发布素材及生成结果具有必要授权或其他合法依据，并对自身违法使用行为依法承担责任。

Erika 对素材的获取、缓存、排版或渲染不构成权利审核，也不授予第三方权利。
用户仅使用渲染工具，不会使其自备素材或输出自动改为 MIT；输出包含内置素材时，该部分仍适用上文的素材许可。

在适用法律允许的范围内，项目及维护者不保证用户素材或生成结果不侵犯第三方权利，并对用户未经授权使用素材所引发的索赔、损失或争议免责。
本声明不排除或限制依法不得排除或限制的责任，也不将维护者自身依法应承担的责任转移给用户。

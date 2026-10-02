# erika-psd-toolkit

Erika 的 PSD → 模板 提取器（开发期工具，不进生产镜像）。

## 用法

```bash
pip install -e packages/psd-toolkit
erika-psd extract <path/to/banner.psd> --out packages/templates/extracted/<name>
```

## 输出

| 文件 | 内容 |
|------|------|
| `assets/icon.<png\|jpg>` | 图标智能对象的原始内容 |
| `styles.json` | 文本层逐 run 样式（字体、字号、字距、颜色、run 长度、段落属性） |
| `template.draft.json` | 机器草稿（含待校准假设的注释） |
| `extraction-report.json` | 证据报告：工具版本、命令、图层清单、背景取样、不支持的效果诊断 |

## 支持范围

- 支持的图层类型：`pixel`、`smartobject`、`type`、`group`、`shape`、`adjustment`（结构提取）。
- 图层效果（阴影、描边等）**不还原**，只在报告中输出诊断，不静默丢弃。
- 视觉基线以 Photoshop 导出成品为准；psd-tools 的合成结果仅用于调试。

# 把 MAS 的 README Banner 换成 Erika 动态渲染（camo 链路验收步骤）

## 1. 生成替换片段

Playground 打开：

```
http://localhost:5173/?owner=Moemu&repo=Muika-After-Story
```

调好后点 **HTML <picture>** 标签页复制（亮暗双主题各一个 URL），或直接用下面的
最小片段（把域名换成实际部署地址）：

```html
<picture>
  <source media="(prefers-color-scheme: dark)"
          srcset="https://<部署域名>/v1/banner/Moemu/Muika-After-Story.webp?theme=dark" />
  <img src="https://<部署域名>/v1/banner/Moemu/Muika-After-Story.webp?theme=light"
       alt="Muika-After-Story" />
</picture>
```

单 URL 简化版（省略主题区分，背景自动捕获）：

```md
![Muika-After-Story](https://<部署域名>/v1/banner/Moemu/Muika-After-Story.webp)
```

## 2. 替换 README

`Moemu/Muika-After-Story` 的 README.md 顶部当前是：

```md
![Muika-After-Story](https://raw.githubusercontent.com/Moemu/Muika-After-Story/main/assets/banner.webp)
```

将 `assets/banner.webp` 的引用替换为上面的片段（保留原有的居中写法即可）。

## 3. camo 链路验收清单

1. **显示**：推送后打开仓库主页，Banner 正常显示（camo 代理 URL 形如
   `camo.githubusercontent.com/...`）；
2. **缓存头生效**：`curl -sI <camo-url>` 观察 `cache-control` 透传
   （s-maxage=3600）；
3. **更新链路**：给仓库加/减一个 star（或等待下一次数据刷新），在
   `s-maxage` 窗口过期后强刷页面，确认星标行变化；急性子可用
   `?fresh=1` 变体验证源站已更新；
4. **故障降级**：临时撤销 token 制造限流，确认 README 显示的是
   "暂时不可用"占位图而非破图；
5. **purge（仅排障）**：`curl -X PURGE <camo-url>` 可强制清除 camo 单条缓存。

## 注意

- camo 会缓存图片：星标数的更新粒度 ≈ `s-maxage`（1 小时），这是设计预期；
- `?fresh=1` 让 camo 走 ETag 回源验证（内容没变返回 304，不增加流量），
  但它**不能**清除其他 URL 的 camo 缓存；
- 私有仓库 / 不存在仓库返回占位图，不会破图。

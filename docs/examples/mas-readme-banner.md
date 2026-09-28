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
2. **缓存头记录**：分别对源站 URL 和 Camo URL 执行 `curl -sI`，记录
   `Cache-Control`、`ETag`、`Age`（若有）和时间。源站声明 `s-maxage=3600`，
   Camo 的响应头是否相同需要实测；
3. **更新链路**：观察仓库发生一次数据变化，记录变化时间、源站图片更新时间、
   同一 Camo URL 的图片更新时间。可直接访问源站的 `?fresh=1` 变体验证新数据；
   该变体与原 README URL 是两条不同的缓存记录。观察超过一小时仍未更新时，
   如实记录延迟，不把源站缓存时长当作 Camo 的刷新保证；
4. **故障降级**：先运行 `pnpm --filter @erika/api test`，用受控的上游错误
   验证“旧数据可用时继续出图、无旧数据时显示占位图”。线上仅在独立测试部署中
   注入可控故障，并记录是否命中代理缓存。撤销 token 不能稳定制造限流，
   不应作为故障测试手段；
5. **purge（仅排障）**：`curl -X PURGE <camo-url>` 可强制清除 camo 单条缓存。

## 注意

- 源站声明的一小时共享缓存与 Provider 的缓存是不同层；实际更新时间还受 Camo 策略影响。
- `?fresh=1` 要求源站验证数据并返回 `no-cache`；当客户端携带匹配的 ETag 时可返回 304，
  不保证 Camo 一定发送条件请求，也不能清除其他 URL 的缓存。
- 私有仓库 / 不存在仓库返回占位图，不会破图。

GitHub 官方排障说明：[About anonymized URLs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-anonymized-urls)。

## 验收状态

本地测试覆盖响应与故障分类。Vercel 线上部署、外部仓库 Actions、MAS README 替换、
Camo 实际更新时间与 ghcr 首次发布仍待执行；完成后在此记录部署地址、提交 SHA、时间和结果。

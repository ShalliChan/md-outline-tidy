# Markdown Tool Design System

版本：V0.1  
状态：当前已验证设计基线

本文档记录 `markdown-heading-tool` 当前已经实际实现、经过浏览器使用和人工验收后确认有效的视觉与交互规则。

它是一份持续迭代的工作文档，不是永久不变的规范。

当真实产品经过修改，并确认新的设计明显更好、以后也应该继续遵守时，再同步更新本文档。

不要因为临时实验或单个像素调整频繁修改 Design System。

---

# 1. 设计定位

Markdown Tool 是一个轻量桌面生产力工具。

整体界面应当给人的感觉是：

- 干净
- 精确
- 紧凑
- 克制
- 现代
- 更像成熟工具，而不是网页表单
- 有视觉完成度，但不过度装饰

核心工作区是：

**Before / After 标题结构树**

设计首先服务于以下任务：

1. 快速理解标题层级；
2. 快速发现标题跳级；
3. 高效比较 Before 和 After；
4. 判断哪些标题应该转为正文；
5. 高频操作尽量靠近当前工作区域；
6. 长文档下仍保持较高的信息密度和可读性。

避免：

- 不必要的 Card；
- 到处使用边框；
- 过多阴影；
- 多种互相竞争的强调色；
- 过大的空白；
- 没有结构意义的装饰；
- 典型“开发 Demo”视觉风格。

---

# 2. Design System 的范围

本文档包含两类规则。

## 2.1 可复用基础规则

未来其他生产力工具有可能复用：

- Color
- Surface
- Typography
- Button hierarchy
- Toolbar grouping
- Hover / Selected 等状态
- Spacing
- Radius
- Panel

## 2.2 Markdown Tool 专属规则

只属于当前产品：

- Before / After Tree
- Heading Connector
- H1 主干线
- Heading Dot
- Missing Level
- Tree Row Actions
- Branch Selection

未来其他项目可以参考基础规则，但不要机械复制这些 Tree 专属模式。

---

# 3. 颜色 Color

## 页面背景

主页面：

`#FFFFFF`

---

## Neutral Surface

主要中性 Surface：

`rgb(245,245,247)`

次一级、更浅的 Surface：

`rgb(250,250,250)`

当前使用：

- Source / Target：`245,245,247`
- Before Tree：`245,245,247`
- After Tree：`250,250,250`
- Input / Preview：`245,245,247`
- Body Presets：`250,250,250`
- Text Cleanup Buttons：中性 Surface

大区域优先通过：

- Surface
- spacing
- typography

表达层级。

不要为了区分区域而给所有容器增加边框。

---

## Accent Color

全局保持一套统一的科技蓝 Accent。

优先继续使用项目现有 Accent CSS token / variable，不要在不同组件里创建多个相似但不同的蓝色。

科技蓝主要用于：

- Primary Action
- Interactive Text
- Tree Connector
- Tree Dot
- Section Label
- Selected Outline
- Active Selectable Control

除非有明确语义需求，不新增绿色、紫色、橙色等其他层级色。

---

## Accent 强度

### Strong Accent

强科技蓝：

用于真正的 Primary Action。

例如：

`Continue from Here`

### Soft Accent

浅科技蓝：

用于：

- selected control
- active toggle
- selected Tree outline
- button hover surface

Primary 和 Selected 不应使用完全相同的视觉强度。

---

# 4. 字体 Typography

使用统一的系统字体栈。

推荐：

`-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`

不要仅为了视觉效果引入：

- 外部字体依赖
- 自定义字体文件

---

## 页面标题

`Markdown Heading Tool`

特点：

- 中性灰
- 低强调
- 不与主工作区竞争注意力

---

## Section Label

例如：

- Source Level
- Target Level
- Before
- After
- Input Markdown
- Result Preview

规则：

- 科技蓝
- 约 15px
- 中等强调
- 不需要全大写

`Before / After / Input Markdown / Result Preview`

应属于同一级视觉层级。

---

## Tree Heading Typography

### H1

- 约 19px
- Bold
- Tree 中最强的标题文字层级

### H2–H6

- 约 16px
- Regular

默认只有 H1 使用 Bold。

不要通过 H1～H6 六套明显不同字号表达层级。

标题层级主要由以下因素共同表达：

- indentation
- connector
- dot
- spacing
- H1 emphasis

---

## Body Preset Typography

16px Regular 与 16px Bold：

- 字号完全相同
- 只通过 font-weight 区分

19px Regular 与 19px Bold同理。

16px 与 19px 本身应该存在明显字号差异。

---

# 5. Button 层级

按钮根据**操作角色**决定视觉层级，而不是只因为“它可以点击”。

---

## Primary Action

代表：

当前区域最重要、最高优先级的动作。

当前：

`Continue from Here`

样式：

- 科技蓝背景
- 白字
- Pill Shape
- Toolbar 中最高视觉强调

强蓝色不要大量使用。

---

## Default Action

例如：

- Reset
- 普通工具操作

样式：

- 白色或中性 Surface
- 蓝色 / 蓝灰色文字或图标
- 强度明显低于 Primary

---

## Selectable Control

例如：

- Source Level
- Target Level
- Preview Mode

Selected / Active：

- 浅科技蓝背景
- 科技蓝文字

不要因为它处于 Selected 状态，就使用 Primary 的强蓝色背景。

---

# 6. Button 状态

## Hover

普通白色按钮：

默认：

- 白色

Hover：

- 浅科技蓝背景

Hover 应该能从周围中性 Surface 中被看见，但不要过强。

---

## Pressed

点击反馈：

- 轻微按压
- 短暂出现
- 随即恢复

除非按钮本身代表持久选择，否则不要在点击后留下永久边框或勾选状态。

---

## Disabled

Disabled：

- 降低对比度
- 仍能识别为一个控件

不要让 Disabled 看起来像：

- Active
- Selected

---

# 7. Button Shape

保持少量、稳定的圆角语言。

---

## Pill Shape

用于完整且重要的动作。

当前例如：

- Continue from Here
- Reset
- Copy Split Button

---

## Moderate Radius

用于：

- Icon Button
- Compact Utility Action
- Tree Row Action
- 普通 Secondary Control

不要把所有按钮全部做成 Pill。

---

# 8. Button Group

逻辑相关的按钮应该形成视觉分组。

原则：

**组内距离 < 组间距离**

例如：

- Undo / Redo
- Promote / Demote

必要时可以使用短竖线作为 Group Divider。

如果 spacing 已经足够表达分组，不额外增加无意义 divider。

---

# 9. Toolbar

Toolbar 是 Tree 主工作区的高频操作区。

当前结构：

左侧：

`Copy Rich Text / Copy Markdown`

右侧：

`Undo / Redo → Promote / Demote → Reset → Continue from Here`

规则：

- Copy 独立位于左侧；
- Undo / Redo 紧密成组；
- Promote / Demote 紧密成组；
- Reset 独立；
- Continue 最靠右；
- Continue 是最强 Primary；
- 高频 Tree 操作靠近 After 工作区域。

Toolbar Surface：

`rgb(245,245,247)`

整体应保持安静，不与 Tree 抢注意力。

Sticky 状态可以使用非常轻微的中性阴影，帮助与下方滚动内容分离。

---

# 10. Copy Split Button

Copy 属于一个 Action Family：

- Copy Rich Text
- Copy Markdown

主按钮显示当前模式：

`Copy Rich Text ▼`

或：

`Copy Markdown ▼`

切换 Copy Mode 后：

- 主按钮文案改变；
- 主按钮执行方式改变；
- 不改变 Preview Mode；
- 不进入 Undo / Redo History。

视觉：

- 白色背景
- 科技蓝文字
- 外轮廓 Pill

Copy 左侧不要出现额外科技蓝装饰线。

---

# 11. Preview Toggle

Preview Mode：

`Markdown | Rich Text`

它们属于模式选择，不属于普通 Action Button。

Active：

- 浅科技蓝背景

Inactive：

- 白色
- 轻边框

两个按钮应该明显表现为一个 Button Group。

规则：

- Markdown 最左外侧使用较大 Pill Radius；
- Rich Text 最右外侧使用较大 Pill Radius；
- 两个按钮相邻的一侧使用较小圆角；
- 两按钮间距非常小。

Rich Text 默认 Active。

Preview Mode 与 Copy Mode 相互独立。

---

# 12. Surface System

大区域主要通过 Surface 建立结构。

优先：

- background fill
- spacing
- typography hierarchy

少用：

- nested cards
- repeated borders
- heavy shadow

页面不应该呈现为大量互不相关的小 Card 拼接。

---

# 13. Before / After Workspace

Before 和 After 是一个完整的双列核心工作区。

`Before`

与

`After`

标题位于 Surface 外部的白色页面背景上，但视觉位置要靠近对应 Tree Surface。

---

## Before

Surface：

`rgb(245,245,247)`

作用：

- reference
- comparison

---

## After

Surface：

`rgb(250,250,250)`

作用：

- current result
- main working result

左右两侧要有轻微区别，但仍明显属于同一完整工作区。

不要按每个 H1 Branch 分成独立 Card。

---

# 14. Tree Design Direction

Tree 的设计方向：

**Hybrid Productivity Connector Tree**

它结合：

- 技术性结构几何
- 桌面工具的紧凑密度
- 稍微柔和的视觉处理

Tree 不应该变成：

- 普通 indentation list
- Decorative Mind Map
- 工程 Debugger

Connector、Dot、Typography、Spacing、Hover、Selected 应当构成一套统一系统。

---

# 15. Tree Level Axis

保持：

**24px fixed level axis**

不同 Heading Level 的横向位置应具有明确、稳定的几何规律。

不要为个别层级增加随意的 indentation 数值。

---

# 16. Connector

所有 Tree Connector 使用统一科技蓝。

---

## Horizontal Connector

要求：

- 肉眼粗细一致；
- 长度一致；
- 单层绘制；
- 真正可见末端使用轻微 Rounded Endpoint；
- 不出现随机半截线；
- 不出现重复绘制。

当前目标厚度约：

`2 CSS px`

但：

**最终物理像素视觉一致性比 CSS 声明值更重要。**

---

## Device Pixel / Subpixel

已经验证：

相同 CSS `2px` 并不一定代表浏览器最终视觉完全一致。

当前曾出现：

- row height = 26 CSS px
- DPR = 1.25
- sibling row 步进 = 32.5 physical px
- 不同行落入不同 subpixel phase
- 最终产生一粗一细的抗锯齿差异

因此 Connector 必须：

- 使用统一 drawing primitive；
- 做 device-pixel alignment；
- 避免 sibling connector 落入不同 fractional phase；
- 最终以浏览器真实截图/肉眼结果验收。

---

## 当前 Horizontal Connector 实现原则

所有 horizontal connector 应统一使用：

`.horizontal-connector`

真实 DOM primitive。

旧：

- `.dot-path::after`
- `.current-axis::after`

横线实现不应重新启用。

---

## Vertical Connector

只有 H1 主结构使用连续 Vertical Trunk。

H2–H6 不建立自己的 Vertical Trunk。

Branch 必须在下一个 H1 之前结束。

禁止：

- H1 → 下一个 H1 的错误连接
- descendant branch 延伸进入下一 H1

---

# 17. Tree Dot

Dot 与 Connector 使用同一 Accent Blue。

只保留两套 Dot Size。

---

## H1 Main Dot

- 12px
- Solid
- 不增加额外外圈

---

## Descendant / Structural Dot

- 8px
- H2–H6 共用
- structural node 共用

不要让 H2 / H3 / H4 / H5 / H6 分别使用不同大小 Dot。

Dot 必须与 Connector Axis 精确居中。

---

# 18. Missing Level

Missing Level 是重要信息，不应该弱化。

使用：

- Hollow Dot
- 科技蓝 Outline
- 与 descendant dot 相同外部尺寸
- 同一套 connector geometry

Missing Node 不应该只是一个孤立的空心点。

它必须通过 Horizontal Connector 与目标 Heading 保持结构关系。

不要因为 Missing 就单独引入黄色、红色等警告色。

---

# 19. Tree Spacing

Tree 保持较高信息密度。

当前：

- row height 约 26px
- 同一 H1 Branch 内紧凑
- 不同 H1 Branch 之间间距明显更大

原则：

**Branch Internal = Compact**

**Between H1 Branches = More Space**

H1 与自己的 descendants 应明显属于同一结构组。

不要统一放大所有 Row Spacing。

---

# 20. Row Hover

Hover Heading Row 时：

- Before / After 对应 Row 同步响应；
- Row Background = White；
- Row Height 不变化；
- 不产生 Layout Shift。

Hover 表达：

> 当前正在查看哪一条结构。

它不同于 Selected。

---

# 21. Tree Row Actions

After Row 当前保留既有 4 个 Action。

默认：

- Row Hover 时出现；
- neutral surface。

Action 自身 Hover：

- 浅科技蓝背景。

Click：

- 只出现短暂 Press Feedback；
- 点击结束立即恢复。

持久 Selected 状态应该体现在 Tree Row 本身，而不是 Action Button 上。

---

# 22. Selected Tree State

Selected Row：

- 约 3px 浅科技蓝 Outline；
- Rounded Corners；
- 不使用强蓝实心 Fill。

Selected 的视觉优先级高于 Hover。

Selected Row Hover 时：

- Selected Border 保留；
- Background = White。

---

## Continuous Selection

连续被选中的 Row 应形成：

**一个完整连续的 Rounded Frame**

而不是每一行独立一个 Box。

可继续使用：

- selected-start
- selected-middle
- selected-end
- selected-single

或功能等价实现。

---

## Before / After

Before 和 After 分别绘制自己的 Selection Frame。

禁止：

一个 Selection Border 横跨整个双列 Tree。

Source Level Selection 使用同类 Selection Language。

---

# 23. Input / Preview

Section Label：

- Input Markdown
- Result Preview

使用统一科技蓝 Section Label。

Input / Preview Surface：

`rgb(245,245,247)`

左右应尽量保持：

- 顶部对齐
- Width 对齐
- Height 对齐
- Bottom 对齐

Preview Toggle 不应造成 Result Preview Box 上下移动。

---

# 24. Text Cleanup

不使用大型：

`Text Cleanup`

Card 或标题。

当前操作只有：

- Remove Dividers
- Compress Guide Lines

按钮：

- neutral surface
- moderate radius
- right aligned

通过：

- 短分隔线
- vertical spacing

与主 Tree Workspace 分开。

这是 Secondary / Low-Frequency 区域。

---

# 25. Body Presets Panel

Body Presets 是低频 Settings Area。

Collapsed 和 Expanded 都使用：

`rgb(250,250,250)`

统一 Surface。

包含：

- Manage Body Presets
- Built-in Presets
- Custom Presets
- New Body Preset
- Name
- px
- Bold
- Delete

`Manage Body Presets`

和：

`New Body Preset`

都应该视觉上属于这个 Panel，而不是漂在 Panel 外部。

使用：

- neutral border
- consistent radius
- consistent row height
- aligned columns
- spacing

不要使用重型 Grid。

视觉修改不能破坏：

- Preset Logic
- localStorage
- Edit / Delete
- px
- Bold

---

# 26. Border

Border 应承担明确语义。

适合 Border 的地方：

- Selected
- Focus
- Inactive Mode Control
- 必要的 Settings Control

大区域布局不要依赖 Border 分割。

优先使用：

Surface + Spacing。

---

# 27. Radius

Radius Vocabulary 保持少量且统一。

主要分为：

### Pill Radius

用于：

- Major Action
- Complete Action

### Moderate Radius

用于：

- Normal Control
- Utility Button

### Small Inner Radius

用于：

相邻按钮组成一个 Button Group 时的内部连接侧。

不要给每个组件单独创造新的圆角数值。

---

# 28. Interaction State 语义

不同 State 表达不同信息。

---

## Hover

表达：

> Pointer 当前在查看什么？

表现：

- Tree Row = White
- Button = Soft Tech Blue

---

## Selected

表达：

> 哪个对象在操作结束后仍保持被选择？

表现：

- Persistent Outline
- Active Fill

具体形式取决于组件类型。

---

## Primary

表达：

> 当前区域最重要的动作是什么？

表现：

- Strong Tech Blue
- White Text

---

## Focus

Keyboard Focus 必须可见。

它应该与现有 Selected / Active 设计语言一致，但不要在语义上完全混淆。

不要为每种状态简单创造一种新颜色。

---

# 29. Motion

Motion 目前属于 Optional Polish。

未来可能适合：

Heading → Body 后 Tree 高度变化时的平滑上移。

只有在：

- 不增加 Tree State Complexity
- 不增加明显 Rendering Risk

的情况下才实现。

不要使用：

- Bounce
- Decorative Animation
- Slow Transition

Motion 必须帮助理解结构变化，而不是为了“显得高级”。

---

# 30. UI 实现原则

修改 UI 时：

1. 优先保持已有产品行为；
2. 纯视觉问题优先 CSS；
3. 只有需要真实 State / Geometry 时才增加 JS；
4. 不因为视觉优化引入额外依赖；
5. 不为了代码“更漂亮”进行大规模重构；
6. 继续依靠 Browser Tests 保护既有功能；
7. 最终判断以真实 Browser Rendering 为准。

对于 Tree Connector 这类 Geometry-sensitive UI：

**getComputedStyle() 不是最终验收结果。**

必须检查真实渲染。

---

# 31. Design System 更新规则

以下情况应该更新本文档：

- 一个设计规则发生明确变化；
- 已经实际实现；
- 经过真实使用验证；
- 以后继续开发应该遵循新规则。

以下情况不需要更新：

- 临时实验；
- 被否定的 Mockup；
- 单个 Bug 修复；
- 不改变设计原则的 Pixel Adjustment。

真实产品始终是最终事实来源。

如果代码与本文档不一致：

先判断是否是产品有意演进。

如果新实现已经验证更好，再更新 Design System。

不要为了符合旧文档而强行把产品改回去。

---

# 32. 在其他项目中的复用

未来其他 Productivity Tool 有可能复用：

- Accent / Neutral Surface 方法
- Button Hierarchy
- Hover / Selected 区分
- Toolbar Grouping
- Radius Vocabulary
- Surface > Excessive Border
- Low-frequency Settings Panel
- Compact Productivity Density
- Interaction State Semantics

不要直接复用：

- Before / After Tree
- H1 Vertical Trunk
- Heading Dot
- Missing Level
- Branch Selection

这些属于 Markdown Tool 的产品专属模式。

只有当一条规则已经在多个真实项目中成功使用后，才考虑将其升级为：

- Shared Design System
- Reusable Skill
- 跨项目设计规范

不要因为第一个项目成功，就过早把项目特有设计包装成通用规则。
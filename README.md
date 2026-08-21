# Markdown Tool_V3.1

Markdown Tool_V3.1 是一款桌面优先、可直接在浏览器中打开的 Markdown 结构整理工具，主要用于把 ChatGPT 的长回答整理成结构清晰、适合粘贴到 Yuque 的富文本。

它是一款聚焦真实工作流的效率工具，不是通用 Markdown 编辑器、完整的 Markdown / GFM 实现，也不以源代码编辑为主要目标。项目仅使用 HTML、CSS 和 Vanilla JavaScript，无需 Node、框架、构建步骤或外部依赖。

## 主要工作流

1. 复制 ChatGPT 回答。
2. 粘贴到 **Input Markdown**。支持的剪贴板 HTML 会转换成信息更完整的 Markdown，否则使用纯文本。
3. 在 **Before / After Tree** 中检查标题层级。
4. 调整标题级别，或把选中的标题转换为正文。
5. 在 **Rich Text** 模式中预览结果。
6. 使用 **Copy Rich Text** 复制，再粘贴到 Yuque。

**Copy Rich Text** 是主要输出方式；需要 Markdown 源文本时，可使用 **Copy Markdown**。

## Original → Baseline → Result

工具维护三个产品层面的状态：

| 状态 | 含义 |
| --- | --- |
| **Original** | 当前文档最初建立时的内容；后续转换不会改写它。 |
| **Baseline** | 当前一轮转换的起点。 |
| **Result** | 在 Baseline 上应用当前标题转换、文本整理结果和已保留正文样式后得到的内容。 |

### Continue from Here

**Continue from Here**：将当前 Result 作为新的 Baseline，以便继续下一轮处理。它不代表最终保存，也不会从 Original 重新开始。已经保留的正文样式会按当前产品规则继续保留。

### Reset

**Reset**：将 Original 恢复为 Baseline，并清除后续转换状态和正文样式。

## Before / After Tree

- **Before** 显示当前转换起点的标题结构。
- **After** 显示当前 Result 的标题结构。
- 两侧对照可用于理解层级变化、正文转换、悬停关系和选择范围。
- 每个标题都有内部身份标识，因此显示文字相同的标题仍能被准确区分。

Tree 用于结构对照，不是像素级精确的差异查看器。

## 标题选择与转换

先选择 Source，再选择标题 Target 或正文 preset（预设），Result 会立即更新。

### H1–H6

Source 中的 **H1** 至 **H6** 针对当前范围内对应真实级别的标题。

### H1+–H6+

**Hn+ 不是简单的 `level >= n` 筛选。** 它以真实的 Hn 标题为 root（根），并包含这些标题下真实的 descendants（后代标题）。某个更深层标题如果前面没有对应的 Hn root，不会仅因级别数字更大而被选中。

当 Hn+ 组合被转换到另一个标题级别时，内部相对层级会在 H1–H6 边界内保持不变。

### Minimum Level

**Minimum Level**：动态选择当前文本范围内实际存在的最深标题级别；没有文本选区时使用整个文档。它是一个只选择单一标题级别的 Source 快捷方式。

### Select this heading

- 按内部身份精确选择当前标题。
- 再次操作已选中的标题会取消该标题，不影响其他精确选择。
- 同名标题不会造成选择歧义。

### Select descendants

**Select descendants**：只选择当前标题下方真实的 descendants（后代标题），**不包含当前标题本身**，并在遇到下一个同级或更高级标题时停止。

```text
H2 Parent       → 未选中
├─ H3 Child     → 已选中
└─ H3 Child     → 已选中
```

如果需要“当前标题 + descendants”的旧式范围，可先使用 **Select descendants**，再使用 **Select this heading**。

### Promote / Demote

**Promote / Demote**：调整标题级别，并遵守 H1 与 H6 的边界。Tree 行内的 Promote / Demote 作用于当前标题及其真实 descendants；工具栏 Promote / Demote 作用于当前 Source 选择。

## Heading → Body

选中的标题可以通过以下内置 preset（预设）转换为正文：

- 16px
- 19px
- 16px bold
- 19px bold

自定义 preset 可以设置名称、像素字号和 bold，并通过浏览器 `localStorage` 保存在本地。

Heading → Body 会通过样式 metadata（元数据）保留 Rich Text 预览和 Copy Rich Text 所需的信息，同时避免在可见 Markdown 中加入不必要的语法；只有必要的回退表示会反映到 Markdown。**Continue from Here** 会按当前工作流保留这些信息，**Reset** 会清除它们。标题转换为正文后，仍可通过 Tree 定位到对应内容。

## 文本整理

文本整理操作会生成正常的 Result，并进入应用级历史记录。

### Remove Dividers

**Remove Dividers**：删除 Markdown 分隔线或水平线。Markdown 表格的分隔行会保留，fenced code 内的内容不会被修改。

### Compress Guide Lines

**Compress Guide Lines**：压缩连续、较短、以中文或英文冒号结尾的普通引导行或标签行，主要用于处理 ChatGPT 回答中常见的以下形式：

```text
例如：

输入：

输出：
```

可能被压缩为：

```text
例如：输入：输出：
```

它可以跨过相邻引导行之间的空行，但不会合并一般的短段落，也不会处理标题、列表、引用块、表格、分隔线或 fenced code。

当前不存在 **Short Paragraph Cleanup**、面向用户的长度阈值，也不存在保存在 `localStorage` 中的阈值设置。

### Remove Inline Code

**Remove Inline Code**：删除 inline code 的定界符，同时保留其中的文字。例如：

```markdown
Click `Copy Rich Text`.
```

会变为：

```text
Click Copy Rich Text.
```

该操作同样适用于标题；fenced code 不受影响。

## Rich Paste

剪贴板中包含可用的语义化 HTML 时，**Rich Paste** 会利用其结构恢复信息更完整的 Markdown，而不只依赖可见纯文本。目前重点支持：

- H1–H6 标题
- bold 和 italic
- inline code
- hyperlinks（链接）
- simple tables（简单表格）
- 基本列表、引用块和 fenced code

仅用于设置语义化标题样式的 bold wrapper，不会被错误地重复转换成 `## **Heading**`。如果 HTML 中没有可用的受支持结构，或无法安全完成导入，工具会回退到剪贴板纯文本。

普通 Paste 或 Rich Paste 完成处理并渲染 Tree 后，页面会自动回到顶部，方便立即查看新的 Before / After 结构。

## 表格支持

工具支持常见的 Markdown / GFM 简单表格，包括：

- 表头行和正文行
- 常见列对齐标记
- 可选的行首、行尾竖线
- 转义的 `\|`
- inline code 中的普通竖线
- 单元格中的 bold、italic、inline code 和 hyperlinks

Rich Paste 会把简单的语义化 HTML `<table>` 规范化为 Markdown table。Rich Text 预览和 Copy Rich Text 会将其输出为语义化 HTML table，使 Yuque 能将其识别为真正的表格。

它不是完整的表格引擎。`colspan`、`rowspan`、嵌套表格和电子表格式编辑不属于当前目标；复杂 HTML 表格会使用当前可预期的非表格回退方式。

## Hyperlinks（链接）

链接会在 Rich Paste → Markdown → Rich Text 预览 → Copy Rich Text 的流程中保留。常见安全协议包括 `http`、`https`、`mailto` 和 `tel`；完整路径、查询参数和片段标识会被保留，包括查询参数中的 `&`。

`javascript:`、`data:` 等可执行协议不会重新输出为可点击链接，只保留可见文字。

## Preview 与 Copy

### Preview modes（预览模式）

- **Rich Text**：默认模式
- **Markdown**

### Copy modes（复制模式）

- **Copy Rich Text**
- **Copy Markdown**

Preview mode 与 Copy mode 相互独立。切换当前预览不会改变 Copy split button 的复制模式。Rich Text 预览与 Copy Rich Text 使用相同的渲染规则，以保持结构和格式一致。

## Navigation UX（导航体验）

### 双击 Tree 标题

在 Before 或 After 一侧双击某个标题，会：

- 将页面移动到 Input Markdown / Result Preview 对照区域；
- 让 Input Markdown 定位到对应源标题附近；
- 让当前 Result Preview 定位到对应 Result 内容附近；
- 在条件允许时，尽量让两侧目标接近垂直中央。

Markdown 与 Rich Text 两种 preview mode 均支持该功能；同名标题会按内部身份准确区分；Heading → Body 后仍可定位。双击只负责定位，不会选择或取消标题、触发行内操作、改变 Preview/Copy mode，也不会进入应用级历史记录。

### Input ↔ Result 同步滚动

Input Markdown 与当前 Result Preview 支持双向比例滚动，方便进行并排对照。这是近似同步，不保证像素级行对齐；两侧字号、表格、换行和段落间距不同都可能产生合理偏差。

### Paste → Page Top

普通 Paste 和 Rich Paste 会在导入、状态更新和 Tree 渲染完成后，让浏览器页面回到顶部。普通输入、删除、转换、Undo / Redo、Continue、Reset、preview 切换、复制和定位都不会触发该行为。

定位动效会尊重 `prefers-reduced-motion`。

## Undo / Redo

应用提供最多 50 步的独立 **Undo / Redo** 历史，不依赖 textarea 原生的 Ctrl+Z 历史。

历史记录覆盖有意义的内容和转换变化，包括标题转换、正文样式、由选择范围驱动的转换、Continue、Reset、粘贴或输入变化，以及文本整理操作。Preview mode、滚动、定位等临时 UI 状态不会进入历史。

## 已知边界

- **Desktop-first：** 当前界面主要面向桌面效率工作流设计。Mobile 尚未作为主要优化目标，但并非声明完全不支持。
- **Tables：** 支持 simple tables；复杂的跨行、跨列或嵌套表格不属于当前目标。
- **Warning overlay：** 少数情况下，过长的多行 warning/status 浮层可能与下方内容发生视觉重叠。这是已知的轻微问题，不阻塞正常使用。
- **Markdown 范围：** 不追求完整的 Markdown / GFM 解析或 WYSIWYG 编辑能力。

## 本地运行

使用现代浏览器直接打开 `index.html`，无需安装或构建。

打开 `test.html` 可运行浏览器回归测试。当前自动测试基线为：

```text
270 / 270 passed
```

具体回归测试由 `TEST_CASES.md` 和 `tests.js` 维护；稳定的视觉基础由 `DESIGN_SYSTEM.md` 维护。

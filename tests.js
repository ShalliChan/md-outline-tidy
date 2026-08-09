'use strict';
(function () {
  var tool = window.HeadingTool;
  var results = [];

  function equal(name, actual, expected) {
    results.push({ name: name, pass: actual === expected, detail: actual === expected ? '' : 'Expected:\n' + expected + '\nActual:\n' + actual });
  }
  function deepEqual(name, actual, expected) {
    equal(name, JSON.stringify(actual), JSON.stringify(expected));
  }
  function ok(name, value) {
    results.push({ name: name, pass: Boolean(value), detail: value ? '' : 'Expected truthy value' });
  }
  function full(model) { return { start: 0, end: model.baseline.length }; }

  equal('V1: promote headings', tool.transformHeadings('## A\n### B', 'up'), '# A\n## B');
  equal('V1: H1/H6 boundaries', tool.transformHeadings('# A\n###### B', 'up'), '# A\n##### B');
  equal('V1: body, list and quote unchanged', tool.transformHeadings('text #42\n- # item\n> ## quote', 'down'), 'text #42\n- # item\n> ## quote');
  equal('V1: seven hashes and missing space unchanged', tool.transformHeadings('####### A\n##no-space\n##\tTab', 'up'), '####### A\n##no-space\n##\tTab');
  equal('V1: backtick fence protected', tool.transformHeadings('## A\n```js\n# code\n```\n### B', 'up'), '# A\n```js\n# code\n```\n## B');
  equal('V1: tilde and long fence protected', tool.transformHeadings('~~~~x\n## code\n~~~~\n#### A', 'down'), '~~~~x\n## code\n~~~~\n##### A');
  equal('V1: mismatched and short closers do not close', tool.transformHeadings('`````\n## code\n~~~\n```\n### code\n`````\n#### A', 'up'), '`````\n## code\n~~~\n```\n### code\n`````\n### A');

  var reversible = tool.createState('##### A\n###### B');
  tool.changeOverall(reversible, 1, full(reversible));
  equal('V2: first demotion hits H6 boundary', tool.renderMarkdown(reversible), '###### A\n###### B');
  tool.changeOverall(reversible, -1, full(reversible));
  equal('V2: promotion restores H5/H6', tool.renderMarkdown(reversible), '##### A\n###### B');
  tool.changeOverall(reversible, -1, full(reversible));
  equal('V2: another promotion preserves relative levels', tool.renderMarkdown(reversible), '#### A\n##### B');

  var reverseDirection = tool.createState('# A\n## B');
  tool.changeOverall(reverseDirection, -1, full(reverseDirection));
  tool.changeOverall(reverseDirection, 1, full(reverseDirection));
  equal('V2: reverse boundary direction is reversible', tool.renderMarkdown(reverseDirection), '# A\n## B');

  var mapping = tool.createState('## A\n### B\n## C');
  tool.applyMapping(mapping, 2, 4, full(mapping));
  equal('V2: specified H2 to H4 only', tool.renderMarkdown(mapping), '#### A\n### B\n#### C');

  var selected = tool.createState('## A\n## B\n## C');
  var secondStart = selected.baseline.indexOf('## B');
  tool.applyMapping(selected, 2, 3, { start: secondStart, end: secondStart + 2 });
  equal('V2: mapping only selected range', tool.renderMarkdown(selected), '## A\n### B\n## C');

  var selectedFence = tool.createState('## A\n```\n## code\n```\n## B');
  tool.changeOverall(selectedFence, 1, full(selectedFence));
  equal('V2: selected operation still protects fence', tool.renderMarkdown(selectedFence), '### A\n```\n## code\n```\n### B');

  var edited = tool.createState('##### A\n###### B');
  tool.changeOverall(edited, 2, full(edited));
  edited = tool.createState('## New');
  equal('V2: user edit creates clean baseline', tool.renderMarkdown(edited), '## New');

  var risky = tool.createState('## Parent\n### Child');
  tool.applyMapping(risky, 2, 4, full(risky));
  ok('V2: hierarchy inversion warning', tool.findRisks(risky).length === 1);
  equal('V2: scanner reports heading text', tool.scanMarkdown('# Project\ntext')[0].text, 'Project');

  var lifecycle = tool.createState('## A\n### B');
  tool.applyMapping(lifecycle, 2, 3, full(lifecycle));
  equal('V3: Original remains unchanged while Result changes', lifecycle.original, '## A\n### B');
  equal('V3: Baseline remains unchanged before confirmation', lifecycle.baseline, '## A\n### B');
  equal('V3: Result is computed from Baseline', tool.renderMarkdown(lifecycle), '### A\n### B');
  tool.commitResult(lifecycle);
  equal('V3: confirmation promotes Result to Baseline', lifecycle.baseline, '### A\n### B');
  ok('V3: confirmation clears round mapping', !tool.mappingIsActive(lifecycle));
  tool.changeOverall(lifecycle, 1, full(lifecycle));
  equal('V3: overall shift after confirmation uses new Baseline', tool.renderMarkdown(lifecycle), '#### A\n#### B');

  var overallThenMapping = tool.createState('## A\n### B');
  tool.changeOverall(overallThenMapping, 1, full(overallThenMapping));
  tool.commitResult(overallThenMapping);
  tool.applyMapping(overallThenMapping, 4, 2, full(overallThenMapping));
  equal('V3: overall confirmation then mapping', tool.renderMarkdown(overallThenMapping), '### A\n## B');

  var mappingThenOverall = tool.createState('## A\n### B');
  tool.applyMapping(mappingThenOverall, 2, 4, full(mappingThenOverall));
  tool.commitResult(mappingThenOverall);
  tool.changeOverall(mappingThenOverall, -1, full(mappingThenOverall));
  equal('V3: mapping confirmation then overall', tool.renderMarkdown(mappingThenOverall), '### A\n## B');

  tool.commitResult(mappingThenOverall);
  tool.changeOverall(mappingThenOverall, 2, full(mappingThenOverall));
  tool.resetTransformations(mappingThenOverall);
  equal('V3: reset after multiple rounds restores Original', tool.renderMarkdown(mappingThenOverall), '## A\n### B');
  equal('V3: reset restores Original as Baseline', mappingThenOverall.baseline, mappingThenOverall.original);

  var subtreeRange = tool.createState('# A\n## B\n### C\n#### D\n## E\n### F');
  deepEqual('V3: subtree stops at next same or higher heading', tool.getSubtreeHeadingIds(subtreeRange, 1), [1, 2, 3]);
  deepEqual('V3: H1 subtree includes remaining document', tool.getSubtreeHeadingIds(subtreeRange, 0), [0, 1, 2, 3, 4, 5]);

  var subtreeLevels = tool.createState('### Feature\n#### Input\n#### Output\n##### Copy');
  tool.changeSubtree(subtreeLevels, 0, -1);
  equal('V3: subtree shift preserves internal relative levels', tool.renderMarkdown(subtreeLevels), '## Feature\n### Input\n### Output\n#### Copy');

  var subtreeBoundary = tool.createState('##### A\n###### B\n## C');
  tool.changeSubtree(subtreeBoundary, 0, 1);
  equal('V3: subtree H6 boundary display', tool.renderMarkdown(subtreeBoundary), '###### A\n###### B\n## C');
  tool.changeSubtree(subtreeBoundary, 0, -1);
  equal('V3: subtree boundary shift is reversible', tool.renderMarkdown(subtreeBoundary), '##### A\n###### B\n## C');

  var combined = tool.createState('## A\n### B\n## C');
  tool.changeOverall(combined, 1, full(combined));
  tool.changeSubtree(combined, 0, -1);
  tool.applyMapping(combined, 2, 5, full(combined));
  equal('V3: overall, subtree and mapping share one Result', tool.renderMarkdown(combined), '##### A\n### B\n### C');

  var choices = tool.createState('## A');
  tool.setMappingChoice(choices, 'source', 2, full(choices));
  equal('V3: source-only choice does not transform', tool.renderMarkdown(choices), '## A');
  tool.setMappingChoice(choices, 'target', 4, full(choices));
  equal('V3: two choices transform immediately', tool.renderMarkdown(choices), '#### A');
  tool.setMappingChoice(choices, 'source', 2, full(choices));
  equal('V3: clicking active source cancels conversion', tool.renderMarkdown(choices), '## A');
  tool.setMappingChoice(choices, 'source', 3, full(choices));
  equal('V3: new nonmatching source remains realtime', tool.renderMarkdown(choices), '## A');
  tool.setMappingChoice(choices, 'target', 4, full(choices));
  equal('V3: clicking active target also cancels conversion', tool.renderMarkdown(choices), '## A');

  var mappingImpact = tool.createState('### A\n## B\n### C');
  tool.setMappingChoice(mappingImpact, 'source', 3, full(mappingImpact));
  deepEqual('V5: source-only selection records affected headings', tool.mappingAffectedHeadingIds(mappingImpact), [0, 2]);
  tool.setMappingChoice(mappingImpact, 'target', 2, full(mappingImpact));
  deepEqual('V5: H3 to H2 keeps corresponding affected set', tool.mappingAffectedHeadingIds(mappingImpact), [0, 2]);
  equal('V5: H3 to H2 updates affected result levels', tool.renderMarkdown(mappingImpact), '## A\n## B\n## C');
  tool.setMappingChoice(mappingImpact, 'target', 4, full(mappingImpact));
  deepEqual('V5: changing H3 target keeps highlight correspondence', tool.mappingAffectedHeadingIds(mappingImpact), [0, 2]);
  equal('V5: changing H3 target updates result in realtime', tool.renderMarkdown(mappingImpact), '#### A\n## B\n#### C');
  tool.setMappingChoice(mappingImpact, 'target', 4, full(mappingImpact));
  deepEqual('V5: target cancellation retains source-side affected set', tool.mappingAffectedHeadingIds(mappingImpact), [0, 2]);
  tool.setMappingChoice(mappingImpact, 'source', 3, full(mappingImpact));
  deepEqual('V5: source cancellation clears affected set', tool.mappingAffectedHeadingIds(mappingImpact), []);

  deepEqual('V3: dot path H1', tool.ancestorPaths([1]), [[]]);
  deepEqual('V3: dot path complete H1-H2-H3', tool.ancestorPaths([1, 2, 3]), [[], [true], [true, true]]);
  deepEqual('V3: dot path H1-H3 missing H2', tool.ancestorPaths([1, 3]), [[], [true, false]]);
  deepEqual('V3: dot path H1-H4 missing H2/H3', tool.ancestorPaths([1, 4]), [[], [true, false, false]]);
  deepEqual('V3: dot path H1-H2-H4', tool.ancestorPaths([1, 2, 4]), [[], [true], [true, true, false]]);
  deepEqual('V3: dot path document starts at H3', tool.ancestorPaths([3]), [[false, false]]);
  deepEqual('V3: new H1 branch clears old H2 ancestor', tool.ancestorPaths([1, 2, 1, 3]), [[], [true], [], [true, false]]);
  deepEqual('V4: shallower H3 keeps valid H1 and H2 ancestors', tool.ancestorPaths([1, 2, 4, 3]), [[], [true], [true, true, false], [true, true]]);
  deepEqual('V6: ancestor line continues only into connected next row', tool.ancestorContinuations(tool.ancestorPaths([1, 2, 3])), [[], [true], [false, false]]);
  deepEqual('V6: ancestor line ends before a new root branch', tool.ancestorContinuations(tool.ancestorPaths([1, 2, 1])), [[], [false], []]);

  var selectionSubtree = tool.createState('## A\n### B\n## C');
  var thirdStart = selectionSubtree.baseline.indexOf('## C');
  tool.changeOverall(selectionSubtree, 1, { start: thirdStart, end: thirdStart + 2 });
  equal('V3: selected overall still leaves outside unchanged', tool.renderMarkdown(selectionSubtree), '## A\n### B\n### C');

  var preset16 = tool.DEFAULT_PRESETS[0];
  var preset19 = tool.DEFAULT_PRESETS[1];
  var preset16Bold = tool.DEFAULT_PRESETS[2];
  var body16 = tool.createState('#### A\n### B');
  tool.applyPresetMapping(body16, 4, preset16, full(body16));
  equal('B1: H4 to 16px body removes heading marker', tool.renderMarkdown(body16), 'A\n### B');
  deepEqual('B2: H4 body metadata maps to source line', tool.renderResult(body16).metadata[0],
    { kind: 'body', fontSize: 16, bold: false, presetId: 'default-16', presetName: '16px 正文' });

  var bodyBold = tool.createState('#### Notice');
  tool.applyPresetMapping(bodyBold, 4, preset16Bold, full(bodyBold));
  equal('B3: bold body has Markdown fallback', tool.renderMarkdown(bodyBold), '**Notice**');
  ok('B4: bold body metadata is bold', tool.renderResult(bodyBold).metadata[0].bold);

  var body19 = tool.createState('#### Larger');
  tool.applyPresetMapping(body19, 4, preset19, full(body19));
  equal('B5: 19px body removes heading marker', tool.renderMarkdown(body19), 'Larger');
  equal('B6: 19px metadata stores size', tool.renderResult(body19).metadata[0].fontSize, 19);

  var presetChoice = tool.createState('#### A');
  tool.setMappingChoice(presetChoice, 'source', 4, full(presetChoice));
  tool.setPresetChoice(presetChoice, preset16, full(presetChoice));
  equal('B7: preset choice activates body conversion', tool.renderMarkdown(presetChoice), 'A');
  tool.setPresetChoice(presetChoice, preset16, full(presetChoice));
  equal('B8: repeated preset choice cancels target', tool.renderMarkdown(presetChoice), '#### A');
  tool.setPresetChoice(presetChoice, preset16, full(presetChoice));
  tool.setMappingChoice(presetChoice, 'target', 2, full(presetChoice));
  ok('B9: heading target and preset target are exclusive', presetChoice.mappingPreset === null && presetChoice.mappingTarget === 2);
  tool.setPresetChoice(presetChoice, preset16Bold, full(presetChoice));
  ok('B10: preset target clears heading target', presetChoice.mappingTarget === null && presetChoice.mappingPreset.id === preset16Bold.id);

  var metadataLife = tool.createState('#### Body\n## Heading');
  tool.applyPresetMapping(metadataLife, 4, preset16Bold, full(metadataLife));
  tool.commitResult(metadataLife);
  ok('B11: continue retains committed rich metadata', metadataLife.baselineMetadata[0].bold);
  tool.applyMapping(metadataLife, 2, 3, full(metadataLife));
  equal('B12: later Hx to Hy keeps body text', tool.renderMarkdown(metadataLife), '**Body**\n### Heading');
  ok('B13: later Hx to Hy keeps rich metadata', tool.renderResult(metadataLife).metadata[0].bold);
  tool.resetTransformations(metadataLife);
  equal('B14: reset restores Original after rich rounds', tool.renderMarkdown(metadataLife), '#### Body\n## Heading');
  deepEqual('B15: reset clears all rich metadata', metadataLife.baselineMetadata, {});
  var editedRich = tool.createState('#### Old');
  tool.applyPresetMapping(editedRich, 4, preset16, full(editedRich));
  tool.commitResult(editedRich);
  editedRich = tool.createState('New input');
  deepEqual('B16: new user input invalidates old metadata', editedRich.baselineMetadata, {});

  var dynamic = tool.createState('# A\n## B\ntext\n#### D\n##### E');
  deepEqual('B17: lowest and second-lowest use existing levels', tool.dynamicSourceLevels(dynamic, full(dynamic)),
    { lowest: 5, secondLowest: 4 });
  var oneLevel = tool.createState('text\n### A\n### B');
  deepEqual('B18: one heading level disables second-lowest', tool.dynamicSourceLevels(oneLevel, full(oneLevel)),
    { lowest: 3, secondLowest: null });
  var noLevels = tool.createState('plain text');
  deepEqual('B19: no headings disables both dynamic sources', tool.dynamicSourceLevels(noLevels, full(noLevels)),
    { lowest: null, secondLowest: null });
  var selectedDynamic = tool.createState('# A\n#### B\n##### C');
  var h4Start = selectedDynamic.baseline.indexOf('#### B');
  deepEqual('B20: dynamic source respects selected range', tool.dynamicSourceLevels(selectedDynamic, { start: h4Start, end: h4Start + 4 }),
    { lowest: 4, secondLowest: null });

  var ghostModel = tool.createState('## Parent\n### Child');
  tool.applyPresetMapping(ghostModel, 2, preset16, full(ghostModel));
  deepEqual('B21: body conversion reports converted heading ids', tool.renderResult(ghostModel).convertedHeadingIds, [0]);
  equal('B22: converted body is absent from result heading scanner', tool.scanMarkdown(tool.renderMarkdown(ghostModel)).length, 1);
  equal('B23: parent-to-body with children creates structure warning', tool.findBodyConversionRisks(ghostModel).length, 1);

  var richPayload = tool.createState('#### Body');
  tool.applyPresetMapping(richPayload, 4, preset16Bold, full(richPayload));
  var payload = tool.createClipboardPayload(richPayload);
  ok('B24: rich clipboard always has text/plain content', payload.plain === '**Body**');
  ok('B25: rich clipboard HTML has font size', payload.html.indexOf('font-size:16px') !== -1);
  ok('B26: rich clipboard HTML has bold weight', payload.html.indexOf('font-weight:700') !== -1);
  var plainPayload = tool.createClipboardPayload(tool.createState('## Plain'));
  ok('B27: no preset keeps ordinary copy path', !plainPayload.hasRich && plainPayload.html === null);
  var safeHtml = tool.markdownToHtml('```html\n<script>alert(1)</script>\n```', {});
  ok('B28: fenced HTML is escaped in rich renderer', safeHtml.indexOf('&lt;script&gt;') !== -1 && safeHtml.indexOf('<script>') === -1);

  equal('B29: remove common thematic breaks',
    tool.removeThematicBreaks('A\n---\nB\n***\nC\n___\nD'), 'A\nB\nC\nD');
  equal('B30: thematic breaks inside fences remain',
    tool.removeThematicBreaks('```\n---\n***\n___\n```\n---'), '```\n---\n***\n___\n```');
  equal('B31: guide lines separated by a blank line are compressed',
    tool.compressGuideLines('例如：\n\n输入：'), '例如：输入：');
  equal('B32: guide lines separated by multiple blanks are compressed',
    tool.compressGuideLines('例如：\n\n\n\n输入：'), '例如：输入：');
  equal('B33: three consecutive guide lines compress into one',
    tool.compressGuideLines('示例：\n\n原文：\n\n输出：'), '示例：原文：输出：');
  equal('B34: blanks after the final guide line remain intact',
    tool.compressGuideLines('例如：\n\n输入：\n\n普通正文'), '例如：输入：\n\n普通正文');
  equal('B35: ordinary short body is never merged by length alone',
    tool.compressGuideLines('很短\n下一段正文。'), '很短\n下一段正文。');
  equal('B36: a guide line before fenced code remains structurally separate',
    tool.compressGuideLines('例如：\n\n```\n输入：\n```'), '例如：\n\n```\n输入：\n```');
  equal('B37: heading, list, quote, table and thematic break do not participate',
    tool.compressGuideLines('## 标题：\n输入：\n\n- 列表：\n输出：\n\n> 引用：\n原文：\n\n| 表格： |\n示例：\n\n---\n结束：'),
    '## 标题：\n输入：\n\n- 列表：\n输出：\n\n> 引用：\n原文：\n\n| 表格： |\n示例：\n\n---\n结束：');
  deepEqual('B38: cleanup conservatively remaps unchanged rich lines',
    tool.remapMetadataByContent('styled\n---\nplain', 'styled\nplain',
      { 0: { fontSize: 16 }, 2: { fontSize: 18 } }),
    { 0: { fontSize: 16 }, 1: { fontSize: 18 } });
  deepEqual('B39: changed rich line metadata safely expires',
    tool.remapMetadataByContent('short\nnext', 'short next', { 0: { fontSize: 16 } }), {});

  deepEqual('C1: default presets use 16px and 19px variants',
    tool.DEFAULT_PRESETS.map(function (preset) { return [preset.name, preset.fontSize, preset.bold]; }),
    [['16px 正文', 16, false], ['19px 正文', 19, false], ['16px 加粗', 16, true], ['19px 加粗', 19, true]]);
  var savedCustom = { id: 'custom-kept', name: '自定义 18px', fontSize: 18, bold: true };
  var combinedPresets = tool.combinePresets([savedCustom]);
  deepEqual('C2: custom preset remains unchanged beside new defaults', combinedPresets[4], savedCustom);

  var sourceModes = tool.createState('### A\n#### B');
  tool.setSourceChoice(sourceModes, 3, 'single', full(sourceModes));
  ok('C3: H3 single source activates alone', sourceModes.mappingSource === 3 && sourceModes.mappingSourceMode === 'single');
  tool.setSourceChoice(sourceModes, 3, 'and-below', full(sourceModes));
  ok('C4: H3 and H3+ are mutually exclusive', sourceModes.mappingSource === 3 && sourceModes.mappingSourceMode === 'and-below');
  tool.setSourceChoice(sourceModes, 3, 'and-below', full(sourceModes));
  ok('C5: repeated H3+ cancels source', sourceModes.mappingSource === null);

  var plusImpact = tool.createState('## A\n### B\n#### C\n##### D\n###### E');
  tool.setSourceChoice(plusImpact, 3, 'and-below', full(plusImpact));
  deepEqual('C6: H3+ matches actual H3 through H6 headings', tool.mappingAffectedHeadingIds(plusImpact), [1, 2, 3, 4]);
  tool.setMappingChoice(plusImpact, 'target', 2, full(plusImpact));
  equal('C7: H3+ to H2 preserves relative levels', tool.renderMarkdown(plusImpact),
    '## A\n## B\n### C\n#### D\n##### E');
  deepEqual('C8: H3+ highlight correspondence remains the affected set',
    tool.mappingAffectedHeadingIds(plusImpact), [1, 2, 3, 4]);

  var h4Plus = tool.createState('### A\n#### B\n##### C\n###### D');
  tool.applyMapping(h4Plus, 4, 2, full(h4Plus), 'and-below');
  equal('C9: H4+ to H2 preserves relative levels', tool.renderMarkdown(h4Plus),
    '### A\n## B\n### C\n#### D');

  var plusBody = tool.createState('### A\n#### B\n##### C\n###### D');
  tool.applyPresetMapping(plusBody, 4, preset19, full(plusBody), 'and-below');
  equal('C10: H4+ to 19px preset converts all lower headings', tool.renderMarkdown(plusBody), '### A\nB\nC\nD');
  deepEqual('C11: H4+ body conversion records every matching metadata line',
    Object.keys(tool.renderResult(plusBody).metadata).map(Number), [1, 2, 3]);
  ok('C12: H4+ rich clipboard retains 19px metadata',
    tool.createClipboardPayload(plusBody).html.indexOf('font-size:19px') !== -1);

  var plusSelection = tool.createState('### A\n#### B\n##### C');
  var selectedH4 = plusSelection.baseline.indexOf('#### B');
  tool.applyMapping(plusSelection, 3, 2, { start: 0, end: selectedH4 + 4 }, 'and-below');
  equal('C13: Hn+ matches only real branches inside the selection',
    tool.renderMarkdown(plusSelection), '## A\n### B\n##### C');

  var ghostMarkup = tool.bodyGhostHtml({ text: '注意事项' }, 'impact impact-after');
  ok('C14: body ghost shows title without preset description labels',
    ghostMarkup.indexOf('注意事项') !== -1 && ghostMarkup.indexOf('正文') === -1 &&
      ghostMarkup.indexOf('19px') === -1 && ghostMarkup.indexOf('加粗') === -1);

  var navigationModel = tool.createState('## A');
  tool.applyMapping(navigationModel, 2, 3, full(navigationModel));
  var focusCalls = 0;
  var scrollCalls = 0;
  var fakeEditor = { value: '', focus: function () { focusCalls += 1; } };
  var originalScrollTo = window.scrollTo;
  window.scrollTo = function () { scrollCalls += 1; };
  tool.continueStateWithoutNavigation(navigationModel, fakeEditor);
  equal('C15: Continue does not focus the input', focusCalls, 0);
  equal('C16: Continue does not request scrolling', scrollCalls, 0);
  tool.resetStateWithoutNavigation(navigationModel, fakeEditor);
  equal('C17: Reset does not focus the input', focusCalls, 0);
  equal('C18: Reset does not request scrolling', scrollCalls, 0);

  var h1Branches = tool.createState('## 孤立 H2\n# A\n## B\n### C\n# D\n### E');
  tool.setSourceChoice(h1Branches, 1, 'and-below', full(h1Branches));
  deepEqual('D1: H1+ excludes an H2 without an actual H1 ancestor',
    tool.mappingAffectedHeadingIds(h1Branches), [1, 2, 3, 4, 5]);
  ok('D2: H1+ includes a skipped-level H3 under a real H1',
    tool.mappingAffectedHeadingIds(h1Branches).indexOf(5) !== -1);

  var h3Branches = tool.createState('#### 孤立 H4\n### A\n#### B\n##### C\n## Stop\n#### 另一个孤立 H4');
  tool.setSourceChoice(h3Branches, 3, 'and-below', full(h3Branches));
  deepEqual('D3: H3+ contains only real H3 roots and descendants',
    tool.mappingAffectedHeadingIds(h3Branches), [1, 2, 3]);
  tool.setMappingChoice(h3Branches, 'target', 2, full(h3Branches));
  equal('D4: branch-correct H3+ to heading keeps relative levels',
    tool.renderMarkdown(h3Branches),
    '#### 孤立 H4\n## A\n### B\n#### C\n## Stop\n#### 另一个孤立 H4');

  var h3PresetBranches = tool.createState('#### 孤立 H4\n### A\n#### B\n##### C\n## Stop\n#### 另一个孤立 H4');
  tool.applyPresetMapping(h3PresetBranches, 3, preset19, full(h3PresetBranches), 'and-below');
  equal('D5: H3+ preset converts only the real H3 branch',
    tool.renderMarkdown(h3PresetBranches),
    '#### 孤立 H4\nA\nB\nC\n## Stop\n#### 另一个孤立 H4');
  deepEqual('D6: H3+ preset metadata maps only matched branch lines',
    Object.keys(tool.renderResult(h3PresetBranches).metadata).map(Number), [1, 2, 3]);

  var duplicateTitles = tool.createState('#### 相同标题\n#### 相同标题\n#### 其他');
  tool.setExactSourceChoice(duplicateTitles, 1, full(duplicateTitles));
  deepEqual('D7: exact Source distinguishes identical titles by heading id',
    tool.mappingAffectedHeadingIds(duplicateTitles), [1]);
  tool.setMappingChoice(duplicateTitles, 'target', 3, full(duplicateTitles));
  equal('D8: exact Source to heading changes only one row',
    tool.renderMarkdown(duplicateTitles), '#### 相同标题\n### 相同标题\n#### 其他');
  deepEqual('D9: exact Source highlight correspondence remains one row',
    tool.mappingAffectedHeadingIds(duplicateTitles), [1]);

  var exactPreset = tool.createState('#### 相同标题\n#### 相同标题');
  tool.setExactSourceChoice(exactPreset, 1, full(exactPreset));
  tool.setPresetChoice(exactPreset, preset19, full(exactPreset));
  equal('D10: exact Source to preset converts only the chosen title',
    tool.renderMarkdown(exactPreset), '#### 相同标题\n相同标题');
  deepEqual('D11: exact Source preset metadata maps only the chosen line',
    Object.keys(tool.renderResult(exactPreset).metadata).map(Number), [1]);

  var exactScrollModel = tool.createState('### A\n### B');
  tool.setExactSourceChoice(exactScrollModel, 1, full(exactScrollModel));
  equal('D12: exact Source does not request scrolling', scrollCalls, 0);
  window.scrollTo = originalScrollTo;

  var list = document.getElementById('results');
  results.forEach(function (result) {
    var item = document.createElement('li');
    item.className = result.pass ? 'pass' : 'fail';
    item.textContent = (result.pass ? 'PASS: ' : 'FAIL: ') + result.name;
    if (result.detail) {
      var detail = document.createElement('pre');
      detail.textContent = result.detail;
      item.appendChild(detail);
    }
    list.appendChild(item);
  });
  var passed = results.filter(function (result) { return result.pass; }).length;
  var summary = document.getElementById('summary');
  summary.textContent = passed + ' / ' + results.length + ' passed';
  summary.className = passed === results.length ? 'pass' : 'fail';
}());

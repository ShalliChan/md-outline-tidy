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
  deepEqual('B17: lowest uses existing heading levels', tool.dynamicSourceLevels(dynamic, full(dynamic)),
    { lowest: 5 });
  var oneLevel = tool.createState('text\n### A\n### B');
  deepEqual('B18: one heading level still resolves lowest', tool.dynamicSourceLevels(oneLevel, full(oneLevel)),
    { lowest: 3 });
  var noLevels = tool.createState('plain text');
  deepEqual('B19: no headings disables lowest source', tool.dynamicSourceLevels(noLevels, full(noLevels)),
    { lowest: null });
  var selectedDynamic = tool.createState('# A\n#### B\n##### C');
  var h4Start = selectedDynamic.baseline.indexOf('#### B');
  deepEqual('B20: dynamic source respects selected range', tool.dynamicSourceLevels(selectedDynamic, { start: h4Start, end: h4Start + 4 }),
    { lowest: 4 });

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
  ok('B27: headings now use semantic rich copy path', plainPayload.hasRich && plainPayload.html === '<h2>Plain</h2>');
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

  var semanticModel = tool.createState('# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6');
  var semanticHtml = tool.renderRichHtml(semanticModel);
  [1, 2, 3, 4, 5, 6].forEach(function (level) {
    ok('E' + level + ': rich renderer emits semantic H' + level,
      semanticHtml.indexOf('<h' + level + '>H' + level + '</h' + level + '>') !== -1);
  });
  var richBodyModel = tool.createState('#### Body');
  tool.applyPresetMapping(richBodyModel, 4, preset19, full(richBodyModel));
  var richBodyHtml = tool.renderRichHtml(richBodyModel);
  ok('E7: body preset does not emit a heading', richBodyHtml.indexOf('<h4>') === -1 && richBodyHtml.indexOf('<p ') === 0);
  ok('E8: 19px non-bold metadata reaches rich HTML',
    richBodyHtml.indexOf('font-size:19px') !== -1 && richBodyHtml.indexOf('font-weight:400') !== -1);
  var richBoldModel = tool.createState('#### Bold');
  tool.applyPresetMapping(richBoldModel, 4, tool.DEFAULT_PRESETS[3], full(richBoldModel));
  ok('E9: bold metadata reaches rich HTML',
    tool.renderRichHtml(richBoldModel).indexOf('font-weight:700') !== -1);
  equal('E10: Preview renderer and clipboard HTML are identical',
    tool.createClipboardPayload(richBoldModel).html, tool.renderRichHtml(richBoldModel));
  equal('E11: default preview mode is Rich Text', tool.DEFAULT_PREVIEW_MODE, 'rich');

  var shiftSingleUp = tool.createState('### A');
  tool.setSourceChoice(shiftSingleUp, 3, 'single', full(shiftSingleUp));
  ok('F1: H3 source can shift up', tool.shiftSelectedSource(shiftSingleUp, -1));
  equal('F2: H3 source up renders H2', tool.renderMarkdown(shiftSingleUp), '## A');
  var shiftSingleDown = tool.createState('### A');
  tool.setSourceChoice(shiftSingleDown, 3, 'single', full(shiftSingleDown));
  tool.shiftSelectedSource(shiftSingleDown, 1);
  equal('F3: H3 source down renders H4', tool.renderMarkdown(shiftSingleDown), '#### A');
  var shiftPlusUp = tool.createState('### A\n#### B\n##### C');
  tool.setSourceChoice(shiftPlusUp, 3, 'and-below', full(shiftPlusUp));
  tool.shiftSelectedSource(shiftPlusUp, -1);
  equal('F4: H3+ source up preserves relative levels', tool.renderMarkdown(shiftPlusUp), '## A\n### B\n#### C');
  var shiftPlusDown = tool.createState('### A\n#### B\n##### C');
  tool.setSourceChoice(shiftPlusDown, 3, 'and-below', full(shiftPlusDown));
  tool.shiftSelectedSource(shiftPlusDown, 1);
  equal('F5: H3+ source down preserves relative levels', tool.renderMarkdown(shiftPlusDown), '#### A\n##### B\n###### C');
  var shiftLowest = tool.createState('## A\n##### B');
  tool.setSourceChoice(shiftLowest, tool.dynamicSourceLevels(shiftLowest, full(shiftLowest)).lowest, 'single', full(shiftLowest));
  tool.shiftSelectedSource(shiftLowest, 1);
  equal('F6: lowest source supports quick demotion', tool.renderMarkdown(shiftLowest), '## A\n###### B');
  var shiftExact = tool.createState('#### Same\n#### Same');
  tool.setExactSourceChoice(shiftExact, 1, full(shiftExact));
  tool.shiftSelectedSource(shiftExact, -1);
  equal('F7: exact source quick shift keeps heading identity', tool.renderMarkdown(shiftExact), '#### Same\n### Same');
  var shiftH1 = tool.createState('# A');
  tool.setSourceChoice(shiftH1, 1, 'single', full(shiftH1));
  ok('F8: H1 source cannot shift above H1', !tool.selectedSourceCanShift(shiftH1, -1) && !tool.shiftSelectedSource(shiftH1, -1));
  var shiftH6 = tool.createState('###### A');
  tool.setSourceChoice(shiftH6, 6, 'single', full(shiftH6));
  ok('F9: H6 source cannot shift below H6', !tool.selectedSourceCanShift(shiftH6, 1) && !tool.shiftSelectedSource(shiftH6, 1));

  function historyStep(history, model, change) {
    var before = tool.snapshotState(model);
    change();
    tool.pushHistorySnapshot(history, before);
  }

  var headingHistoryModel = tool.createState('### A');
  var headingHistory = tool.createHistory(50);
  historyStep(headingHistory, headingHistoryModel, function () {
    tool.applyMapping(headingHistoryModel, 3, 2, full(headingHistoryModel));
  });
  tool.undoHistory(headingHistory, headingHistoryModel);
  equal('G1: heading conversion Undo restores previous result', tool.renderMarkdown(headingHistoryModel), '### A');
  tool.redoHistory(headingHistory, headingHistoryModel);
  equal('G2: heading conversion Redo restores converted result', tool.renderMarkdown(headingHistoryModel), '## A');

  var plusHistoryModel = tool.createState('### A\n#### B');
  var plusHistory = tool.createHistory(50);
  historyStep(plusHistory, plusHistoryModel, function () {
    tool.applyMapping(plusHistoryModel, 3, 2, full(plusHistoryModel), 'and-below');
  });
  tool.undoHistory(plusHistory, plusHistoryModel);
  tool.redoHistory(plusHistory, plusHistoryModel);
  equal('G3: Hn+ conversion survives Undo and Redo', tool.renderMarkdown(plusHistoryModel), '## A\n### B');

  var bodyHistoryModel = tool.createState('#### Body');
  var bodyHistory = tool.createHistory(50);
  historyStep(bodyHistory, bodyHistoryModel, function () {
    tool.applyPresetMapping(bodyHistoryModel, 4, preset19, full(bodyHistoryModel));
  });
  tool.undoHistory(bodyHistory, bodyHistoryModel);
  deepEqual('G4: body preset Undo removes pending metadata', tool.renderResult(bodyHistoryModel).metadata, {});
  tool.redoHistory(bodyHistory, bodyHistoryModel);
  ok('G5: body preset Redo restores metadata', tool.renderResult(bodyHistoryModel).metadata[0].fontSize === 19);

  var subtreeHistoryModel = tool.createState('### A\n#### B');
  var subtreeHistory = tool.createHistory(50);
  historyStep(subtreeHistory, subtreeHistoryModel, function () { tool.changeSubtree(subtreeHistoryModel, 0, -1); });
  tool.undoHistory(subtreeHistory, subtreeHistoryModel);
  equal('G6: subtree Undo restores all levels', tool.renderMarkdown(subtreeHistoryModel), '### A\n#### B');
  tool.redoHistory(subtreeHistory, subtreeHistoryModel);
  equal('G7: subtree Redo restores relative shift', tool.renderMarkdown(subtreeHistoryModel), '## A\n### B');

  var continueHistoryModel = tool.createState('### A');
  tool.applyMapping(continueHistoryModel, 3, 2, full(continueHistoryModel));
  var continueHistory = tool.createHistory(50);
  historyStep(continueHistory, continueHistoryModel, function () { tool.commitResult(continueHistoryModel); });
  tool.undoHistory(continueHistory, continueHistoryModel);
  ok('G8: Continue Undo restores pre-commit Baseline and mapping',
    continueHistoryModel.baseline === '### A' && tool.renderMarkdown(continueHistoryModel) === '## A');
  tool.redoHistory(continueHistory, continueHistoryModel);
  ok('G9: Continue Redo restores committed Baseline', continueHistoryModel.baseline === '## A' && !tool.mappingIsActive(continueHistoryModel));

  var resetHistoryModel = tool.createState('#### Body');
  tool.applyPresetMapping(resetHistoryModel, 4, preset19, full(resetHistoryModel));
  tool.commitResult(resetHistoryModel);
  var resetHistory = tool.createHistory(50);
  historyStep(resetHistory, resetHistoryModel, function () { tool.resetTransformations(resetHistoryModel); });
  tool.undoHistory(resetHistory, resetHistoryModel);
  ok('G10: Reset Undo restores committed text and rich metadata',
    resetHistoryModel.baseline === 'Body' && resetHistoryModel.baselineMetadata[0].fontSize === 19);

  var clearHistoryModel = tool.createState('## Keep');
  var clearHistory = tool.createHistory(50);
  historyStep(clearHistory, clearHistoryModel, function () {
    tool.restoreState(clearHistoryModel, tool.createState(''));
  });
  tool.undoHistory(clearHistory, clearHistoryModel);
  equal('G11: Clear Undo restores the complete document', clearHistoryModel.original, '## Keep');

  var branchModel = tool.createState('### A');
  var branchHistory = tool.createHistory(50);
  historyStep(branchHistory, branchModel, function () { tool.applyMapping(branchModel, 3, 2, full(branchModel)); });
  tool.undoHistory(branchHistory, branchModel);
  historyStep(branchHistory, branchModel, function () { tool.applyMapping(branchModel, 3, 4, full(branchModel)); });
  ok('G12: new operation after Undo clears Redo branch', branchHistory.redo.length === 0 && !tool.redoHistory(branchHistory, branchModel));

  var passiveHistoryModel = tool.createState('## A');
  var passiveHistory = tool.createHistory(50);
  tool.renderRichHtml(passiveHistoryModel);
  tool.createClipboardPayload(passiveHistoryModel);
  ok('G13: Preview and Copy do not enter application history',
    passiveHistory.undo.length === 0 && passiveHistory.redo.length === 0);
  var snapshotIdentityModel = tool.createState('#### Same\n#### Same');
  tool.setExactSourceChoice(snapshotIdentityModel, 1, full(snapshotIdentityModel));
  var identitySnapshot = tool.snapshotState(snapshotIdentityModel);
  tool.setExactSourceChoice(snapshotIdentityModel, 0, full(snapshotIdentityModel));
  tool.restoreState(snapshotIdentityModel, identitySnapshot);
  deepEqual('G14: snapshots preserve exact heading identity and Source state',
    tool.mappingAffectedHeadingIds(snapshotIdentityModel), [1]);
  var richDecision = tool.importClipboardContent('<h1><b>Title</b></h1>', 'Title');
  ok('H1: semantic heading HTML selects Rich Import', richDecision.usedRich && richDecision.headingCount === 1);
  var plainDecision = tool.importClipboardContent('<p><strong>Body</strong></p>', 'Plain body');
  deepEqual('H2: HTML without semantic headings falls back to plain text', plainDecision,
    { text: 'Plain body', usedRich: false, headingCount: 0 });
  equal('H3: rich importer maps H1 through H6',
    tool.richHtmlToMarkdown('<h1>A</h1><h2>B</h2><h3>C</h3><h4>D</h4><h5>E</h5><h6>F</h6>'),
    '# A\n\n## B\n\n### C\n\n#### D\n\n##### E\n\n###### F');
  equal('H4: heading strong and b wrappers do not create bold Markdown',
    tool.richHtmlToMarkdown('<h2><span class="s1"><b>Bold visual title</b></span></h2>'),
    '## Bold visual title');
  equal('H5: paragraph strong and b remain bold',
    tool.richHtmlToMarkdown('<h1>Title</h1><p><strong>A</strong> and <b>B</b></p>'),
    '# Title\n\n**A** and **B**');
  equal('H6: paragraph em and i remain italic',
    tool.richHtmlToMarkdown('<h1>Title</h1><p><em>A</em> and <i>B</i></p>'),
    '# Title\n\n*A* and *B*');
  equal('H7: unordered list imports as Markdown list',
    tool.richHtmlToMarkdown('<h1>Title</h1><ul><li>A</li><li>B</li></ul>'),
    '# Title\n\n- A\n- B');
  equal('H8: ordered list imports as Markdown list',
    tool.richHtmlToMarkdown('<h1>Title</h1><ol><li>A</li><li>B</li></ol>'),
    '# Title\n\n1. A\n2. B');
  equal('H9: nested lists receive basic indentation',
    tool.richHtmlToMarkdown('<h1>Title</h1><ul><li>A<ul><li>B</li></ul></li></ul>'),
    '# Title\n\n- A\n  - B');
  var inlineTick = String.fromCharCode(96);
  equal('H10: inline code imports with inline fences',
    tool.richHtmlToMarkdown('<h1>Title</h1><p>Use <code>x()</code> now</p>'),
    '# Title\n\nUse ' + inlineTick + 'x()' + inlineTick + ' now');
  var tick = String.fromCharCode(96);
  equal('H11: pre code imports as fenced block with reliable language',
    tool.richHtmlToMarkdown('<h1>Title</h1><pre><code class="language-js">const x = 1;</code></pre>'),
    '# Title\n\n' + tick + tick + tick + 'js\nconst x = 1;\n' + tick + tick + tick);
  equal('H12: links preserve text and href',
    tool.richHtmlToMarkdown('<h1>Title</h1><p><a href="https://example.com">Example</a></p>'),
    '# Title\n\n[Example](https://example.com)');
  equal('H13: semantic blockquote imports with quote markers',
    tool.richHtmlToMarkdown('<h1>Title</h1><blockquote><p>A</p><p>B</p></blockquote>'),
    '# Title\n\n> A\n>\n> B');
  equal('H14: visual span class and style wrappers are ignored',
    tool.richHtmlToMarkdown('<div class="p1"><h1><span class="s1" style="color:red"><b>Title</b></span></h1><p><span class="s2">Body</span></p></div>'),
    '# Title\n\nBody');
  deepEqual('H15: importer error safely falls back to plain text',
    tool.importClipboardContent('<h1>Title</h1>', 'Plain fallback', function () { throw new Error('test'); }),
    { text: 'Plain fallback', usedRich: false, headingCount: 0 });

  var pasteHistoryModel = tool.createState('## Before');
  var pasteHistory = tool.createHistory(50);
  var pasteBefore = tool.snapshotState(pasteHistoryModel);
  tool.restoreState(pasteHistoryModel, tool.createState(richDecision.text));
  tool.pushHistorySnapshot(pasteHistory, pasteBefore);
  tool.undoHistory(pasteHistory, pasteHistoryModel);
  equal('H16: Rich Paste is one Undo history step', pasteHistoryModel.original, '## Before');
  tool.redoHistory(pasteHistory, pasteHistoryModel);
  equal('H17: Rich Paste Redo restores imported Markdown', pasteHistoryModel.original, '# Title');

  var copyModeModel = tool.createState('## Copy');
  equal('I1: Rich copy HTML uses the unified renderer',
    tool.createClipboardPayload(copyModeModel).html, tool.renderRichHtml(copyModeModel));
  deepEqual('I2: Markdown copy contains only current Markdown text',
    tool.createMarkdownClipboardPayload(copyModeModel), { plain: '## Copy', html: null, hasRich: false });
  equal('I3: preview mode does not change Rich copy type',
    tool.createClipboardPayload(copyModeModel).html, '<h2>Copy</h2>');
  equal('I4: preview mode does not change Markdown copy type',
    tool.createMarkdownClipboardPayload(copyModeModel).plain, '## Copy');

  var exactMulti = tool.createState('## Same\n#### Same\n### Other');
  tool.setExactSourceChoice(exactMulti, 0, full(exactMulti));
  tool.setExactSourceChoice(exactMulti, 1, full(exactMulti));
  deepEqual('J1: same-title headings can be selected by stable ids',
    tool.mappingAffectedHeadingIds(exactMulti), [0, 1]);
  tool.setExactSourceChoice(exactMulti, 0, full(exactMulti));
  deepEqual('J2: exact selection toggles independently', tool.mappingAffectedHeadingIds(exactMulti), [1]);
  tool.setExactSourceChoice(exactMulti, 0, full(exactMulti));
  tool.setMappingChoice(exactMulti, 'target', 2, full(exactMulti));
  equal('J3: multiple different levels map to one target',
    tool.renderMarkdown(exactMulti), '## Same\n## Same\n### Other');

  var exactBody = tool.createState('## A\n#### B\n### C');
  tool.setExactSourceChoice(exactBody, 0, full(exactBody));
  tool.setExactSourceChoice(exactBody, 2, full(exactBody));
  tool.setPresetChoice(exactBody, preset19, full(exactBody));
  equal('J4: exact multi selection maps to body preset', tool.renderMarkdown(exactBody), 'A\n#### B\nC');
  deepEqual('J5: exact multi body metadata maps selected lines only',
    Object.keys(tool.renderResult(exactBody).metadata).map(Number), [0, 2]);

  var exactShiftUp = tool.createState('### A\n##### B');
  tool.setExactSourceChoice(exactShiftUp, 0, full(exactShiftUp));
  tool.setExactSourceChoice(exactShiftUp, 1, full(exactShiftUp));
  tool.shiftSelectedSource(exactShiftUp, -1);
  equal('J6: exact multi selection promotes each current level',
    tool.renderMarkdown(exactShiftUp), '## A\n#### B');
  var exactShiftDown = tool.createState('### A\n##### B');
  tool.setExactSourceChoice(exactShiftDown, 0, full(exactShiftDown));
  tool.setExactSourceChoice(exactShiftDown, 1, full(exactShiftDown));
  tool.shiftSelectedSource(exactShiftDown, 1);
  equal('J7: exact multi selection demotes each current level',
    tool.renderMarkdown(exactShiftDown), '#### A\n###### B');
  var exactBoundaries = tool.createState('# A\n###### B');
  tool.setExactSourceChoice(exactBoundaries, 0, full(exactBoundaries));
  tool.setExactSourceChoice(exactBoundaries, 1, full(exactBoundaries));
  ok('J8: exact multi respects H1 and H6 quick-shift boundaries',
    !tool.selectedSourceCanShift(exactBoundaries, -1) && !tool.selectedSourceCanShift(exactBoundaries, 1));
  tool.setSourceChoice(exactMulti, 3, 'single', full(exactMulti));
  ok('J9: Group Source clears exact multi selection',
    exactMulti.mappingHeadingIds.length === 0 && exactMulti.mappingSource === 3);
  tool.setExactSourceChoice(exactMulti, 2, full(exactMulti));
  ok('J10: exact row action deselects a heading selected by Group Source',
    exactMulti.mappingSource === null && exactMulti.mappingSourceMode === 'exact' && exactMulti.mappingHeadingIds.length === 0);

  var branchModel = tool.createState('# A\n## B\n### C\n## D\n# E\n### Skip');
  tool.setBranchSourceChoice(branchModel, 1, full(branchModel));
  deepEqual('K1: branch Source contains root and true descendants only',
    tool.mappingAffectedHeadingIds(branchModel), [1, 2]);
  tool.setBranchSourceChoice(branchModel, 0, full(branchModel));
  deepEqual('K2: branch stops at next same-level heading and includes skipped descendants',
    tool.mappingAffectedHeadingIds(branchModel), [0, 1, 2, 3]);
  tool.setBranchSourceChoice(branchModel, 1, full(branchModel));
  tool.setMappingChoice(branchModel, 'target', 1, full(branchModel));
  equal('K3: branch to heading preserves relative levels',
    tool.renderMarkdown(branchModel), '# A\n# B\n## C\n## D\n# E\n### Skip');

  var branchBody = tool.createState('### Root\n#### Child\n## Stop');
  tool.setBranchSourceChoice(branchBody, 0, full(branchBody));
  tool.setPresetChoice(branchBody, preset16, full(branchBody));
  equal('K4: branch maps every member to body preset',
    tool.renderMarkdown(branchBody), 'Root\nChild\n## Stop');
  deepEqual('K5: branch body metadata covers branch lines',
    Object.keys(tool.renderResult(branchBody).metadata).map(Number), [0, 1]);

  var branchShift = tool.createState('# Root\n###### Child\n# Stop');
  tool.setBranchSourceChoice(branchShift, 0, full(branchShift));
  tool.shiftSelectedSource(branchShift, -1);
  equal('K6: branch quick shift uses reversible boundary offsets',
    tool.renderMarkdown(branchShift), '# Root\n##### Child\n# Stop');
  tool.shiftSelectedSource(branchShift, 1);
  equal('K7: reversing branch quick shift restores original levels',
    tool.renderMarkdown(branchShift), '# Root\n###### Child\n# Stop');
  var sameBranchNames = tool.createState('### Same\n#### Child\n### Same\n#### Other');
  tool.setBranchSourceChoice(sameBranchNames, 2, full(sameBranchNames));
  deepEqual('K8: same-title branch root uses stable heading id',
    tool.mappingAffectedHeadingIds(sameBranchNames), [2, 3]);

  var oneBlankParagraphs = tool.createState('First paragraph.\n\nSecond paragraph.');
  equal('L1: one Markdown blank line separates paragraphs without an empty Rich block',
    tool.renderRichHtml(oneBlankParagraphs), '<p>First paragraph.</p><p>Second paragraph.</p>');
  var manyBlankParagraphs = tool.createState('First paragraph.\n\n\n\nSecond paragraph.');
  equal('L2: consecutive Markdown blank lines normalize to the same Rich block boundary',
    tool.renderRichHtml(manyBlankParagraphs), tool.renderRichHtml(oneBlankParagraphs));
  equal('L3: heading and paragraph boundary has no empty Rich paragraph',
    tool.renderRichHtml(tool.createState('## Heading\n\nBody.')), '<h2>Heading</h2><p>Body.</p>');
  equal('L4: paragraph followed by heading has no meaningless Rich break',
    tool.renderRichHtml(tool.createState('Body.\n\n## Heading')), '<p>Body.</p><h2>Heading</h2>');
  equal('L5: blank lines around a list do not add empty items or paragraphs',
    tool.renderRichHtml(tool.createState('Before.\n\n- A\n- B\n\nAfter.')),
    '<p>Before.</p><ul><li>A</li><li>B</li></ul><p>After.</p>');
  var fenceMarker = String.fromCharCode(96) + String.fromCharCode(96) + String.fromCharCode(96);
  equal('L6: fenced code preserves all internal line breaks during Rich normalization',
    tool.renderRichHtml(tool.createState('Before.\n\n' + fenceMarker + '\nline 1\n\nline 3\n' + fenceMarker + '\n\nAfter.')),
    '<p>Before.</p><pre><code>line 1\n\nline 3</code></pre><p>After.</p>');
  var richWhitespacePreset = tool.createState('## Styled\n\nTail.');
  tool.setExactSourceChoice(richWhitespacePreset, 0, full(richWhitespacePreset));
  tool.setPresetChoice(richWhitespacePreset, tool.DEFAULT_PRESETS[3], full(richWhitespacePreset));
  equal('L7: 19px bold body metadata survives Rich whitespace normalization',
    tool.renderRichHtml(richWhitespacePreset),
    '<p style="margin:0;font-size:19px;font-weight:700;"><strong>Styled</strong></p><p>Tail.</p>');
  equal('L8: Copy Rich Text still uses the same normalized renderer as Rich Preview',
    tool.createClipboardPayload(manyBlankParagraphs).html, tool.renderRichHtml(manyBlankParagraphs));
  var untouchedMarkdown = 'First paragraph.\n\n\nSecond paragraph.';
  var untouchedMarkdownModel = tool.createState(untouchedMarkdown);
  deepEqual('L9: Rich normalization does not change Markdown Result or Copy Markdown',
    [tool.renderMarkdown(untouchedMarkdownModel), tool.createMarkdownClipboardPayload(untouchedMarkdownModel).plain],
    [untouchedMarkdown, untouchedMarkdown]);

  equal('M1: body inline code delimiters are removed',
    tool.removeInlineCode('Please click `Copy Rich Text`.'), 'Please click Copy Rich Text.');
  equal('M2: heading inline code delimiters are removed',
    tool.removeInlineCode('## Use `Reset`'), '## Use Reset');
  equal('M3: multiple inline-code spans and delimiter lengths are supported',
    tool.removeInlineCode('Use ``a`b`` and `c`.'), 'Use a`b and c.');
  var inlineFence = 'Before `x`\n```js\nconst value = `kept`;\n```\nAfter `y`';
  equal('M4: fenced code remains unchanged while surrounding inline code is cleaned',
    tool.removeInlineCode(inlineFence), 'Before x\n```js\nconst value = `kept`;\n```\nAfter y');
  equal('M5: normal Markdown blocks remain intact around inline code',
    tool.removeInlineCode('- Keep **bold** and `code`\n> Quote `value`'), '- Keep **bold** and code\n> Quote value');
  equal('M6: escaped literal backticks are not treated as inline code',
    tool.removeInlineCode('Keep \\`literal\\` and remove `code`'), 'Keep \\`literal\\` and remove code');
  var inlineHistoryModel = tool.createState('## Use `Reset`\nBody `value`');
  var inlineHistory = tool.createHistory(50);
  historyStep(inlineHistory, inlineHistoryModel, function () {
    tool.applyTextResult(inlineHistoryModel, tool.removeInlineCode(inlineHistoryModel.baseline));
  });
  equal('M7: Remove Inline Code produces one normal content result',
    tool.renderMarkdown(inlineHistoryModel), '## Use Reset\nBody value');
  tool.undoHistory(inlineHistory, inlineHistoryModel);
  equal('M8: Remove Inline Code Undo restores delimiters',
    tool.renderMarkdown(inlineHistoryModel), '## Use `Reset`\nBody `value`');
  tool.redoHistory(inlineHistory, inlineHistoryModel);
  equal('M9: Remove Inline Code Redo restores cleaned content',
    tool.renderMarkdown(inlineHistoryModel), '## Use Reset\nBody value');

  var toggleGroup = tool.createState('## Same\n## Same\n### Other');
  tool.setSourceChoice(toggleGroup, 2, 'single', full(toggleGroup));
  tool.setExactSourceChoice(toggleGroup, 0, full(toggleGroup));
  deepEqual('N1: selected heading toggles off without affecting other selected headings',
    tool.mappingAffectedHeadingIds(toggleGroup), [1]);
  tool.setExactSourceChoice(toggleGroup, 2, full(toggleGroup));
  deepEqual('N2: unselected heading toggles on within a mixed exact selection',
    tool.mappingAffectedHeadingIds(toggleGroup), [1, 2]);
  tool.setExactSourceChoice(toggleGroup, 1, full(toggleGroup));
  deepEqual('N3: duplicate heading text remains ID-safe during deselection',
    tool.mappingAffectedHeadingIds(toggleGroup), [2]);

  var descendants = tool.createState('## Root\n#### Skipped child\n##### Nested\n## Stop\n# Higher stop\n### Outside');
  tool.setDescendantsSourceChoice(descendants, 0, full(descendants));
  deepEqual('O1: descendants exclude the current root and include nested skipped levels',
    tool.mappingAffectedHeadingIds(descendants), [1, 2]);
  tool.setExactSourceChoice(descendants, 0, full(descendants));
  deepEqual('O2: root can be toggled on after descendants to recreate branch membership',
    tool.mappingAffectedHeadingIds(descendants), [0, 1, 2]);
  var descendantBoundary = tool.createState('### Root\n##### Child\n### Same level stop\n#### Not child\n## Higher stop\n###### Also outside');
  tool.setDescendantsSourceChoice(descendantBoundary, 0, full(descendantBoundary));
  deepEqual('O3: same-level and higher-level headings terminate descendant range',
    tool.mappingAffectedHeadingIds(descendantBoundary), [1]);
  var duplicateDescendants = tool.createState('### Same\n#### First\n### Same\n##### Second');
  tool.setDescendantsSourceChoice(duplicateDescendants, 2, full(duplicateDescendants));
  deepEqual('O4: same-name descendant roots remain ID-safe',
    tool.mappingAffectedHeadingIds(duplicateDescendants), [3]);

  equal('P1: proportional scroll maps Input midpoint to Result midpoint',
    tool.proportionalScrollTop({ scrollTop: 400, scrollHeight: 1000, clientHeight: 200 },
      { scrollHeight: 600, clientHeight: 200 }), 200);
  equal('P2: proportional scroll handles a non-scrollable source safely',
    tool.proportionalScrollTop({ scrollTop: 0, scrollHeight: 200, clientHeight: 200 },
      { scrollHeight: 600, clientHeight: 200 }), 0);

  var simpleTableMarkdown = '| Feature | Status |\n| --- | --- |\n| Rich Copy | Supported |\n| Table | Supported |';
  var simpleTableHtml = tool.markdownToHtml(simpleTableMarkdown, {});
  ok('Q1: simple Markdown table renders semantic table sections and cells',
    simpleTableHtml.indexOf('<table><thead><tr>') === 0 &&
    simpleTableHtml.indexOf('</thead><tbody>') !== -1 &&
    simpleTableHtml.indexOf('<th ') !== -1 && simpleTableHtml.indexOf('<td ') !== -1);
  equal('Q2: multiple table body rows remain distinct',
    (simpleTableHtml.match(/<tr>/g) || []).length, 3);
  var alignedTableHtml = tool.markdownToHtml('| Left | Center | Right |\n| :--- | :---: | ---: |\n| A | B | C |', {});
  ok('Q3: table alignment syntax reaches semantic cell styles',
    alignedTableHtml.indexOf('text-align:left') !== -1 && alignedTableHtml.indexOf('text-align:center') !== -1 &&
    alignedTableHtml.indexOf('text-align:right') !== -1);
  var escapedPipeHtml = tool.markdownToHtml('| Value | Other |\n| --- | --- |\n| A \\| B | C |', {});
  ok('Q4: escaped pipe remains in one table cell',
    escapedPipeHtml.indexOf('>A | B</td>') !== -1 && (escapedPipeHtml.match(/<td /g) || []).length === 2);
  var codePipeHtml = tool.markdownToHtml('| Code | Other |\n| --- | --- |\n| `a | b` | C |', {});
  ok('Q5: pipe inside inline code remains in one cell',
    codePipeHtml.indexOf('<code>a | b</code>') !== -1 && (codePipeHtml.match(/<td /g) || []).length === 2);
  var noOuterPipesHtml = tool.markdownToHtml('Feature | Status\n--- | ---\nRich Copy | Supported', {});
  ok('Q6: leading and trailing pipes are optional for simple tables', noOuterPipesHtml.indexOf('<table>') === 0);
  var paragraphTableHtml = tool.markdownToHtml('Before.\n\n' + simpleTableMarkdown + '\n\nAfter.', {});
  ok('Q7: table between paragraphs remains an independent block',
    paragraphTableHtml.indexOf('<p>Before.</p><table>') === 0 && paragraphTableHtml.indexOf('</table><p>After.</p>') !== -1);
  var headingTableHtml = tool.markdownToHtml('## Before\n\n' + simpleTableMarkdown + '\n\n### After', {});
  ok('Q8: table boundaries remain intact between headings',
    headingTableHtml.indexOf('<h2>Before</h2><table>') === 0 && headingTableHtml.indexOf('</table><h3>After</h3>') !== -1);
  var fencedTableMarkdown = '```md\n| A | B |\n| --- | --- |\n```';
  var fencedTableHtml = tool.markdownToHtml(fencedTableMarkdown, {});
  ok('Q9: fenced table-like text remains code',
    fencedTableHtml.indexOf('<pre><code>| A | B |') === 0 && fencedTableHtml.indexOf('<table>') === -1);
  equal('Q10: Copy Markdown preserves an original Markdown table',
    tool.createMarkdownClipboardPayload(tool.createState(simpleTableMarkdown)).plain, simpleTableMarkdown);
  deepEqual('Q11: table cell text is not scanned as a heading',
    tool.scanMarkdown('# Name | Value\n--- | ---\nCell | Other'), []);

  var formattedCellHtml = tool.markdownToHtml('| Bold | Italic | Code |\n| --- | --- | --- |\n| **Yes** | *Maybe* | `x()` |', {});
  ok('R1: table cells reuse bold, italic, and inline-code semantics',
    formattedCellHtml.indexOf('<strong>Yes</strong>') !== -1 && formattedCellHtml.indexOf('<em>Maybe</em>') !== -1 &&
    formattedCellHtml.indexOf('<code>x()</code>') !== -1);
  equal('R1b: ordinary intraword underscores remain literal text',
    tool.markdownToHtml('snake_case_name', {}), '<p>snake_case_name</p>');
  equal('R1c: Markdown link syntax inside inline code remains code',
    tool.markdownToHtml('`[Docs](https://example.com)`', {}), '<p><code>[Docs](https://example.com)</code></p>');
  equal('R1d: inline code inside a safe link label remains formatted',
    tool.markdownToHtml('[Use `Copy`](https://example.com)', {}),
    '<p><a href="https://example.com">Use <code>Copy</code></a></p>');
  var completeUrl = 'https://example.com/path?a=1&b=2#section';
  equal('R2: body hyperlink preserves protocol, path, query, and fragment',
    tool.markdownToHtml('[Documentation](' + completeUrl + ')', {}),
    '<p><a href="https://example.com/path?a=1&amp;b=2#section">Documentation</a></p>');
  equal('R3: heading hyperlink remains clickable in Rich HTML',
    tool.markdownToHtml('## [Documentation](' + completeUrl + ')', {}),
    '<h2><a href="https://example.com/path?a=1&amp;b=2#section">Documentation</a></h2>');
  ok('R4: table-cell hyperlink remains clickable with its complete URL',
    tool.markdownToHtml('| Docs |\n| --- |\n| [Documentation](' + completeUrl + ') |', {})
      .indexOf('<a href="https://example.com/path?a=1&amp;b=2#section">Documentation</a>') !== -1);
  ok('R5: http, mailto, and tel links remain allowed',
    tool.markdownToHtml('[Web](http://example.com) [Mail](mailto:a@example.com) [Call](tel:+123)', {})
      .match(/<a href=/g).length === 3);
  var unsafeLinkHtml = tool.markdownToHtml('[Run](javascript:alert(1))', {});
  ok('R6: unsafe Markdown href preserves visible text without an executable link',
    unsafeLinkHtml === '<p>Run</p>' && unsafeLinkHtml.indexOf('<a ') === -1);
  equal('R7: data scheme is also rendered as visible text only',
    tool.markdownToHtml('[Payload](data:text/html,boom)', {}), '<p>Payload</p>');

  var importedTableHtml = '<table><tr><th>Name</th><th>Link</th></tr>' +
    '<tr><td>OpenAI</td><td><a href="https://example.com/path?a=1&amp;b=2#top">Website</a></td></tr>' +
    '<tr><td>Docs</td><td><strong>Bold</strong> and <em>Italic</em> and <code>x()</code></td></tr></table>';
  var importedTableMarkdown = '| Name | Link |\n| --- | --- |\n' +
    '| OpenAI | [Website](https://example.com/path?a=1&b=2#top) |\n' +
    '| Docs | **Bold** and *Italic* and `x()` |';
  equal('S1: Rich Paste HTML table normalizes th, td, rows, and columns to Markdown',
    tool.richHtmlToMarkdown(importedTableHtml), importedTableMarkdown);
  var importedTableDecision = tool.importClipboardContent(importedTableHtml, 'plain fallback');
  ok('S2: semantic HTML table selects Rich Import without requiring a heading',
    importedTableDecision.usedRich && importedTableDecision.headingCount === 0 &&
    importedTableDecision.text === importedTableMarkdown);
  ok('S3: HTML table import preserves link, bold, italic, and inline code',
    importedTableDecision.text.indexOf('[Website](https://example.com/path?a=1&b=2#top)') !== -1 &&
    importedTableDecision.text.indexOf('**Bold** and *Italic* and `x()`') !== -1);
  var bodyLinkDecision = tool.importClipboardContent(
    '<p>Read <a href="https://example.com/path?a=1&amp;b=2#section">Documentation</a></p>', 'Read Documentation');
  equal('S4: safe body link selects Rich Import and decodes HTML ampersand correctly',
    bodyLinkDecision.text, 'Read [Documentation](https://example.com/path?a=1&b=2#section)');
  equal('S5: unsafe HTML href imports as visible text only',
    tool.richHtmlToMarkdown('<table><tr><th>Action</th></tr><tr><td><a href="javascript:alert(1)">Run</a></td></tr></table>'),
    '| Action |\n| --- |\n| Run |');
  equal('S6: complex colspan table uses predictable non-table fallback',
    tool.richHtmlToMarkdown('<table><tr><th colspan="2">Group</th></tr><tr><td>A</td><td>B</td></tr></table>'),
    'Group\nA — B');
  equal('S7: Rich Paste preserves a complete safe link inside a heading',
    tool.richHtmlToMarkdown('<h2><a href="https://example.com/path?a=1&amp;b=2#section">Docs</a></h2>'),
    '## [Docs](https://example.com/path?a=1&b=2#section)');

  equal('T1: Remove Dividers preserves table delimiter rows',
    tool.removeThematicBreaks(simpleTableMarkdown), simpleTableMarkdown);
  equal('T2: Compress Guide Lines leaves table rows unchanged',
    tool.compressGuideLines(simpleTableMarkdown), simpleTableMarkdown);
  ok('T3: table rendering does not reintroduce empty Rich paragraphs',
    paragraphTableHtml.indexOf('<p><br></p>') === -1 && paragraphTableHtml.indexOf('<p></p>') === -1);
  equal('T4: Rich Copy continues to use the same table renderer as Rich Preview',
    tool.createClipboardPayload(tool.createState(simpleTableMarkdown)).html,
    tool.renderRichHtml(tool.createState(simpleTableMarkdown)));
  equal('T5: existing semantic heading Rich Paste remains unchanged',
    tool.importClipboardContent('<h1>Title</h1>', 'Title').text, '# Title');

  var navigationDuplicates = tool.createState('## Same\nBody\n## Same');
  deepEqual('U1: duplicate heading navigation resolves the requested structural id',
    tool.headingNavigationTarget(navigationDuplicates, 1),
    { headingId: 1, sourceLineIndex: 2, resultLineIndex: 2, resultKind: 'heading' });
  equal('U2: Before and After navigation resolve to the same structural target',
    tool.headingNavigationTarget(navigationDuplicates, 1).headingId,
    tool.resultHeadingNavigationMap(navigationDuplicates)[2]);

  var navigationBody = tool.createState('### Notes\nBody');
  tool.setExactSourceChoice(navigationBody, 0, full(navigationBody));
  tool.setPresetChoice(navigationBody, preset16, full(navigationBody));
  deepEqual('U3: heading-to-body navigation preserves source and Result mapping',
    tool.headingNavigationTarget(navigationBody, 0),
    { headingId: 0, sourceLineIndex: 0, resultLineIndex: 0, resultKind: 'body' });
  ok('U4: Rich Preview marks a converted body block with its heading id',
    tool.renderRichHtml(navigationBody, true).indexOf('<p data-heading-id="0"') === 0);
  ok('U5: navigation markers do not enter Rich Copy output',
    tool.createClipboardPayload(navigationBody).html.indexOf('data-heading-id') === -1);

  var navigationSelection = tool.createState('## A\n## B');
  tool.setExactSourceChoice(navigationSelection, 1, full(navigationSelection));
  var navigationSelectionBefore = tool.snapshotState(navigationSelection);
  tool.headingNavigationTarget(navigationSelection, 0);
  deepEqual('U6: resolving a double-click navigation target does not change selection state',
    tool.snapshotState(navigationSelection), navigationSelectionBefore);
  deepEqual('U7: Rich Preview navigation map keeps duplicate headings ID-safe',
    tool.resultHeadingNavigationMap(navigationDuplicates), { 0: 0, 2: 1 });
  equal('U8: textarea navigation centers an interior source line',
    tool.centeredScrollTopForLine('a\nb\nc\nd\ne', 2, 500, 100), 200);
  equal('U9: textarea navigation clamps the first line to the scroll start',
    tool.centeredScrollTopForLine('a\nb\nc', 0, 300, 200), 0);

  ok('U10: plain paste completion requests page-top navigation',
    tool.shouldReturnToTopAfterEdit('insertFromPaste', false));
  ok('U11: Rich Paste completion requests page-top navigation',
    tool.shouldReturnToTopAfterEdit(null, true));
  ok('U12: ordinary edits do not request page-top navigation',
    !tool.shouldReturnToTopAfterEdit('insertText', false) &&
    !tool.shouldReturnToTopAfterEdit('deleteContentBackward', false));

  var continuousToolbar = tool.createState('### A\n## Existing\n### B');
  tool.setSourceChoice(continuousToolbar, 3, 'single', full(continuousToolbar));
  tool.shiftSelectedSource(continuousToolbar, -1);
  tool.shiftSelectedSource(continuousToolbar, -1);
  equal('V7-1: toolbar Promote can run repeatedly on one Source group',
    tool.renderMarkdown(continuousToolbar), '# A\n## Existing\n# B');
  deepEqual('V7-2: repeated toolbar Promote keeps the original logical heading ids',
    tool.mappingAffectedHeadingIds(continuousToolbar), [0, 2]);
  tool.shiftSelectedSource(continuousToolbar, 1);
  equal('V7-3: Promote then Promote then Demote stays on the same headings',
    tool.renderMarkdown(continuousToolbar), '## A\n## Existing\n## B');

  var continuousDemote = tool.createState('### A\n#### Existing\n### B');
  tool.setSourceChoice(continuousDemote, 3, 'single', full(continuousDemote));
  tool.shiftSelectedSource(continuousDemote, 1);
  tool.shiftSelectedSource(continuousDemote, 1);
  equal('V7-4: toolbar Demote can run repeatedly without absorbing current-level headings',
    tool.renderMarkdown(continuousDemote), '##### A\n#### Existing\n##### B');
  deepEqual('V7-5: repeated toolbar Demote retains stable selected ids',
    tool.mappingAffectedHeadingIds(continuousDemote), [0, 2]);

  var continuousPlus = tool.createState('### Root\n#### Child\n## Stop\n### Outside');
  tool.setSourceChoice(continuousPlus, 3, 'and-below',
    { start: 0, end: continuousPlus.baseline.indexOf('## Stop') });
  tool.shiftSelectedSource(continuousPlus, -1);
  tool.shiftSelectedSource(continuousPlus, -1);
  equal('V7-6: Hn+ continuous Promote keeps its real root and descendants',
    tool.renderMarkdown(continuousPlus), '# Root\n## Child\n## Stop\n### Outside');
  deepEqual('V7-7: Hn+ continuous selection does not drift beyond its original range',
    tool.mappingAffectedHeadingIds(continuousPlus), [0, 1]);

  var continuousExact = tool.createState('#### A\n## Keep\n#### B');
  tool.setExactSourceChoice(continuousExact, 0, full(continuousExact));
  tool.setExactSourceChoice(continuousExact, 2, full(continuousExact));
  tool.shiftSelectedSource(continuousExact, -1);
  tool.shiftSelectedSource(continuousExact, -1);
  tool.shiftSelectedSource(continuousExact, -1);
  equal('V7-8: exact multi-selection supports three consecutive Promote steps',
    tool.renderMarkdown(continuousExact), '# A\n## Keep\n# B');
  deepEqual('V7-9: exact multi-selection identity remains stable after repeated shifts',
    tool.mappingAffectedHeadingIds(continuousExact), [0, 2]);

  var continuousMixedBoundary = tool.createState('### A\n#### B');
  tool.setExactSourceChoice(continuousMixedBoundary, 0, full(continuousMixedBoundary));
  tool.setExactSourceChoice(continuousMixedBoundary, 1, full(continuousMixedBoundary));
  tool.shiftSelectedSource(continuousMixedBoundary, 1);
  tool.shiftSelectedSource(continuousMixedBoundary, 1);
  equal('V7-10: repeated Demote preserves mixed exact-selection relative levels',
    tool.renderMarkdown(continuousMixedBoundary), '##### A\n###### B');
  ok('V7-11: mixed selection safely no-ops when another Demote would cross H6',
    !tool.shiftSelectedSource(continuousMixedBoundary, 1) &&
    tool.renderMarkdown(continuousMixedBoundary) === '##### A\n###### B');

  var continuousMapped = tool.createState('### A');
  tool.setSourceChoice(continuousMapped, 3, 'single', full(continuousMapped));
  tool.setMappingChoice(continuousMapped, 'target', 2, full(continuousMapped));
  ok('V7-12: toolbar shift can adopt an equivalent current conversion for continuation',
    tool.shiftSelectedSource(continuousMapped, -1) && continuousMapped.mappingTarget === null &&
    tool.renderMarkdown(continuousMapped) === '## A');
  tool.shiftSelectedSource(continuousMapped, -1);
  equal('V7-13: adopted conversion continues to the next heading level',
    tool.renderMarkdown(continuousMapped), '# A');

  var continuousRowPromote = tool.createState('#### Parent\n##### Child\n#### Stop');
  tool.changeSubtree(continuousRowPromote, 0, -1);
  tool.changeSubtree(continuousRowPromote, 0, -1);
  tool.changeSubtree(continuousRowPromote, 0, -1);
  equal('V7-14: Tree row branch supports three consecutive Promote steps',
    tool.renderMarkdown(continuousRowPromote), '# Parent\n## Child\n#### Stop');

  var continuousRowDemote = tool.createState('## Parent\n### Child\n## Stop');
  tool.changeSubtree(continuousRowDemote, 0, 1);
  tool.changeSubtree(continuousRowDemote, 0, 1);
  tool.changeSubtree(continuousRowDemote, 0, 1);
  equal('V7-15: Tree row branch supports consecutive Demote and stops at the next peer',
    tool.renderMarkdown(continuousRowDemote), '##### Parent\n###### Child\n## Stop');

  var continuousDuplicateBranch = tool.createState('### Same\n#### First\n### Same\n#### Second');
  tool.changeSubtree(continuousDuplicateBranch, 2, -1);
  tool.changeSubtree(continuousDuplicateBranch, 2, -1);
  equal('V7-16: repeated Tree row shifts remain duplicate-title ID-safe',
    tool.renderMarkdown(continuousDuplicateBranch), '### Same\n#### First\n# Same\n## Second');

  var rowBoundaryNoOp = tool.createState('# Root\n# Stop');
  var rowBoundaryBefore = tool.snapshotState(rowBoundaryNoOp);
  ok('V7-17: Tree row Promote at a complete H1 boundary is a stable no-op',
    !tool.changeSubtree(rowBoundaryNoOp, 0, -1));
  deepEqual('V7-18: Tree row boundary no-op does not mutate offsets or state',
    tool.snapshotState(rowBoundaryNoOp), rowBoundaryBefore);

  function continuousHistoryStep(history, model, change) {
    var before = tool.snapshotState(model);
    var changed = change();
    if (changed) tool.pushHistorySnapshot(history, before);
    return changed;
  }
  var continuousHistoryModel = tool.createState('#### A');
  var continuousHistory = tool.createHistory(50);
  tool.setSourceChoice(continuousHistoryModel, 4, 'single', full(continuousHistoryModel));
  continuousHistoryStep(continuousHistory, continuousHistoryModel, function () {
    return tool.shiftSelectedSource(continuousHistoryModel, -1);
  });
  continuousHistoryStep(continuousHistory, continuousHistoryModel, function () {
    return tool.shiftSelectedSource(continuousHistoryModel, -1);
  });
  continuousHistoryStep(continuousHistory, continuousHistoryModel, function () {
    return tool.shiftSelectedSource(continuousHistoryModel, -1);
  });
  ok('V7-19: every effective continuous Promote creates an independent history step',
    continuousHistory.undo.length === 3 && tool.renderMarkdown(continuousHistoryModel) === '# A');
  tool.undoHistory(continuousHistory, continuousHistoryModel);
  var undoOne = tool.renderMarkdown(continuousHistoryModel);
  tool.undoHistory(continuousHistory, continuousHistoryModel);
  var undoTwo = tool.renderMarkdown(continuousHistoryModel);
  tool.undoHistory(continuousHistory, continuousHistoryModel);
  var undoThree = tool.renderMarkdown(continuousHistoryModel);
  equal('V7-20: Undo restores each Promote level separately',
    [undoOne, undoTwo, undoThree].join('|'), '## A|### A|#### A');
  tool.redoHistory(continuousHistory, continuousHistoryModel);
  tool.redoHistory(continuousHistory, continuousHistoryModel);
  tool.redoHistory(continuousHistory, continuousHistoryModel);
  equal('V7-21: Redo reapplies continuous Promote one level at a time',
    tool.renderMarkdown(continuousHistoryModel), '# A');
  var boundaryHistorySize = continuousHistory.undo.length;
  ok('V7-22: boundary no-op does not add a meaningless history snapshot',
    !continuousHistoryStep(continuousHistory, continuousHistoryModel, function () {
      return tool.shiftSelectedSource(continuousHistoryModel, -1);
    }) && continuousHistory.undo.length === boundaryHistorySize);

  var continuousDemoteHistoryModel = tool.createState('### A');
  var continuousDemoteHistory = tool.createHistory(50);
  tool.setSourceChoice(continuousDemoteHistoryModel, 3, 'single', full(continuousDemoteHistoryModel));
  for (var demoteStep = 0; demoteStep < 3; demoteStep += 1) {
    continuousHistoryStep(continuousDemoteHistory, continuousDemoteHistoryModel, function () {
      return tool.shiftSelectedSource(continuousDemoteHistoryModel, 1);
    });
  }
  ok('V7-23: every effective continuous Demote creates an independent history step',
    continuousDemoteHistory.undo.length === 3 && tool.renderMarkdown(continuousDemoteHistoryModel) === '###### A');
  tool.undoHistory(continuousDemoteHistory, continuousDemoteHistoryModel);
  var demoteUndo = tool.renderMarkdown(continuousDemoteHistoryModel);
  tool.redoHistory(continuousDemoteHistory, continuousDemoteHistoryModel);
  equal('V7-24: Undo and Redo restore continuous Demote one level at a time',
    demoteUndo + '|' + tool.renderMarkdown(continuousDemoteHistoryModel), '##### A|###### A');
  var demoteBoundaryHistorySize = continuousDemoteHistory.undo.length;
  ok('V7-25: H6 toolbar no-op does not add history',
    !continuousHistoryStep(continuousDemoteHistory, continuousDemoteHistoryModel, function () {
      return tool.shiftSelectedSource(continuousDemoteHistoryModel, 1);
    }) && continuousDemoteHistory.undo.length === demoteBoundaryHistorySize);
  var rowH6Boundary = tool.createState('###### Root\n###### Stop');
  ok('V7-26: Tree row Demote at a complete H6 boundary is a stable no-op',
    !tool.changeSubtree(rowH6Boundary, 0, 1) && tool.renderMarkdown(rowH6Boundary) === '###### Root\n###### Stop');

  var h1Trunks = tool.localBranchTrunkStates([1, 2, 2]);
  ok('W1: H1 keeps its main trunk without a duplicate local trunk',
    !h1Trunks[0].rootStarts && h1Trunks[1].ancestorAxis === null && h1Trunks[2].ancestorAxis === null);

  var h2Trunks = tool.localBranchTrunkStates([2, 3, 3]);
  ok('W2: a top-level H2 with descendants starts a local trunk',
    h2Trunks[0].rootStarts && h2Trunks[1].ancestorAxis === 1 && h2Trunks[2].ancestorAxis === 1);

  var h3Trunks = tool.localBranchTrunkStates([3, 4, 4]);
  ok('W3: local root detection is not hard-coded to H2',
    h3Trunks[0].rootStarts && h3Trunks[1].ancestorAxis === 2 && h3Trunks[2].ancestorAxis === 2);

  var multipleLocalLevels = [2, 3, 2, 3];
  var multipleLocalPaths = tool.ancestorPaths(multipleLocalLevels);
  var multipleLocalTrunks = tool.localBranchTrunkStates(multipleLocalLevels, multipleLocalPaths);
  var multipleLocalContinuations = tool.ancestorContinuations(multipleLocalPaths);
  ok('W4: multiple top-level branches each start an independent local trunk',
    multipleLocalTrunks[0].rootStarts && multipleLocalTrunks[2].rootStarts);
  ok('W5: a local trunk ends before the next same-level branch',
    !multipleLocalContinuations[1][1] && multipleLocalTrunks[3].ancestorAxis === 1);

  var leafRoots = tool.localBranchTrunkStates([2, 2]);
  ok('W6: roots without descendants do not receive decorative local trunks',
    !leafRoots[0].rootStarts && !leafRoots[1].rootStarts);

  var skippedLocalTrunks = tool.localBranchTrunkStates([2, 4]);
  ok('W7: skipped levels retain the effective H2 ancestor as the local trunk axis',
    skippedLocalTrunks[0].rootStarts && skippedLocalTrunks[1].ancestorAxis === 1);

  var orphanLocalTrunks = tool.localBranchTrunkStates([4, 3, 4]);
  ok('W8: an orphan deeper heading does not inherit a later independent branch',
    !orphanLocalTrunks[0].rootStarts && orphanLocalTrunks[0].ancestorAxis === null &&
    orphanLocalTrunks[1].rootStarts && orphanLocalTrunks[2].ancestorAxis === 2);

  var beforeRootTrunks = tool.localBranchTrunkStates([1, 2]);
  var afterRootTrunks = tool.localBranchTrunkStates([2, 3]);
  ok('W9: Before H1 and After H2 resolve their trunk types independently',
    !beforeRootTrunks[0].rootStarts && beforeRootTrunks[1].ancestorAxis === null &&
    afterRootTrunks[0].rootStarts && afterRootTrunks[1].ancestorAxis === 1);
  var allLevels = tool.createState('# A\n## B\n### C\n#### D\n##### E\n###### F');
  tool.setSourceChoice(allLevels, null, 'all', full(allLevels));
  deepEqual('All-1: selects every H1 through H6', tool.mappingAffectedHeadingIds(allLevels), [0, 1, 2, 3, 4, 5]);
  equal('All-2: choosing source alone preserves Result', tool.renderMarkdown(allLevels), allLevels.original);
  var allBeforeBoundary = JSON.stringify(allLevels);
  ok('All-3: H1 blocks overall Promote', !tool.shiftSelectedSource(allLevels, -1));
  ok('All-4: H6 blocks overall Demote', !tool.shiftSelectedSource(allLevels, 1));
  equal('All-5: blocked shifts preserve complete state', JSON.stringify(allLevels), allBeforeBoundary);

  var allOrphans = tool.createState('##### Orphan\n### Root\n#### Child\nBody\n```md\n# Fake\n```\n~~~\n## Fake too\n~~~');
  tool.setSourceChoice(allOrphans, null, 'all', full(allOrphans));
  deepEqual('All-6: missing H1 and orphan H3/H4/H5 remain selectable, fences excluded', tool.mappingAffectedHeadingIds(allOrphans), [0, 1, 2]);
  var allRange = { start: allOrphans.baseline.indexOf('### Root'), end: allOrphans.baseline.indexOf('Body') };
  tool.setSourceChoice(allOrphans, 3, 'single', full(allOrphans));
  tool.setSourceChoice(allOrphans, null, 'all', allRange);
  deepEqual('All-7: text selection restricts headings', tool.mappingAffectedHeadingIds(allOrphans), [1, 2]);
  tool.setSourceChoice(allOrphans, null, 'all', allRange);
  ok('All-8: repeated shortcut cancels source', !tool.hasSourceSelection(allOrphans));
  tool.setSourceChoice(allOrphans, null, 'all', { start: allRange.start + 1, end: allRange.end });
  deepEqual('All-9: partial marker follows existing range rule', tool.mappingAffectedHeadingIds(allOrphans), [2]);

  var allContinuous = tool.createState('### A\n##### B\n## C');
  tool.setSourceChoice(allContinuous, null, 'all', full(allContinuous));
  var allHistory = tool.createHistory(50);
  [-1, -1, 1].forEach(function (delta) {
    continuousHistoryStep(allHistory, allContinuous, function () { return tool.shiftSelectedSource(allContinuous, delta); });
  });
  // The second Promote is blocked by C at H1, so only the effective shifts enter history.
  equal('All-10: mixed boundary sequence preserves relative levels', tool.renderMarkdown(allContinuous), allContinuous.original);
  equal('All-11: only effective operations enter history', allHistory.undo.length, 2);
  deepEqual('All-12: logical IDs survive direction changes', allContinuous.mappingHeadingIds, [0, 1, 2]);

  var allSequence = tool.createState('### A\n#### B');
  tool.setSourceChoice(allSequence, null, 'all', full(allSequence));
  var allSequenceHistory = tool.createHistory(50);
  [-1, -1, 1].forEach(function (delta) {
    continuousHistoryStep(allSequenceHistory, allSequence, function () { return tool.shiftSelectedSource(allSequence, delta); });
  });
  equal('All-13: Promote Promote Demote', tool.renderMarkdown(allSequence), '## A\n### B');
  equal('All-14: three effective shifts create three steps', allSequenceHistory.undo.length, 3);
  equal('All-15: shifts retain Baseline until Continue', allSequence.baseline, allSequence.original);
  tool.undoHistory(allSequenceHistory, allSequence);
  equal('All-16: Undo restores previous shift', tool.renderMarkdown(allSequence), '# A\n## B');
  tool.redoHistory(allSequenceHistory, allSequence);
  equal('All-17: Redo restores shift and tracking', tool.renderMarkdown(allSequence), '## A\n### B');
  deepEqual('All-18: Redo retains all selected IDs', tool.mappingAffectedHeadingIds(allSequence), [0, 1]);
  tool.commitResult(allSequence);
  ok('All-19: Continue establishes Result and clears selection tracking', allSequence.baseline === '## A\n### B' && !tool.hasSourceSelection(allSequence) && !allSequence.mappingHeadingIds.length);
  tool.setSourceChoice(allSequence, null, 'all', full(allSequence));
  tool.shiftSelectedSource(allSequence, 1);
  tool.resetTransformations(allSequence);
  ok('All-20: Reset restores Original and clears tracking', tool.renderMarkdown(allSequence) === allSequence.original && !tool.hasSourceSelection(allSequence) && !allSequence.mappingHeadingIds.length);

  tool.setSourceChoice(allSequence, null, 'all', full(allSequence));
  tool.shiftSelectedSource(allSequence, -1);
  tool.setSourceChoice(allSequence, 3, 'single', full(allSequence));
  deepEqual('All-21: switching to Hn clears old IDs', tool.mappingAffectedHeadingIds(allSequence), [1]);
  ok('All-22: Hn tracking storage cleared', !allSequence.mappingHeadingIds.length);
  tool.setSourceChoice(allSequence, 2, 'and-below', full(allSequence));
  deepEqual('All-23: Hn+ branch selection after All Levels', tool.mappingAffectedHeadingIds(allSequence), [0, 1]);
  var allMinimum = tool.dynamicSourceLevels(allSequence, full(allSequence)).lowest;
  tool.setSourceChoice(allSequence, allMinimum, 'single', full(allSequence));
  deepEqual('All-24: Minimum Level retains existing selection', tool.mappingAffectedHeadingIds(allSequence), [1]);
  allSequence.mappingTarget = 1;
  tool.setSourceChoice(allSequence, null, 'all', full(allSequence));
  ok('All-25: All Levels clears pending target without converting', !tool.mappingIsActive(allSequence) && tool.renderMarkdown(allSequence) === '## A\n### B');

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

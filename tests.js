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

  var selectionSubtree = tool.createState('## A\n### B\n## C');
  var thirdStart = selectionSubtree.baseline.indexOf('## C');
  tool.changeOverall(selectionSubtree, 1, { start: thirdStart, end: thirdStart + 2 });
  equal('V3: selected overall still leaves outside unchanged', tool.renderMarkdown(selectionSubtree), '## A\n### B\n### C');

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

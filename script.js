'use strict';

function clampLevel(level) {
  return Math.max(1, Math.min(6, level));
}

function scanMarkdown(markdown) {
  var headings = [];
  var inFence = false;
  var fenceCharacter = '';
  var openingFenceLength = 0;
  var position = 0;

  markdown.split('\n').forEach(function (line, lineIndex) {
    if (inFence) {
      var closing = line.match(/^ {0,3}(`+|~+)[ \t]*$/);
      if (closing && closing[1][0] === fenceCharacter && closing[1].length >= openingFenceLength) {
        inFence = false;
        fenceCharacter = '';
        openingFenceLength = 0;
      }
    } else {
      var opening = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (opening) {
        inFence = true;
        fenceCharacter = opening[1][0];
        openingFenceLength = opening[1].length;
      } else {
        var match = line.match(/^(#{1,6})(?= )(.*)$/);
        if (match) {
          headings.push({
            id: headings.length,
            lineIndex: lineIndex,
            start: position,
            end: position + line.length,
            markerEnd: position + match[1].length,
            level: match[1].length,
            text: match[2].slice(1).replace(/[ \t]+#+[ \t]*$/, '').trim()
          });
        }
      }
    }
    position += line.length + 1;
  });
  return headings;
}

function createState(markdown) {
  var state = {
    original: markdown,
    baseline: markdown,
    markdown: markdown,
    headings: [],
    offsets: [],
    mappingSource: null,
    mappingTarget: null,
    mappingRange: null
  };
  establishBaseline(state, markdown);
  return state;
}

function establishBaseline(model, markdown) {
  model.baseline = markdown;
  model.markdown = markdown;
  model.headings = scanMarkdown(markdown);
  model.offsets = model.headings.map(function () { return 0; });
  model.mappingSource = null;
  model.mappingTarget = null;
  model.mappingRange = null;
  return model;
}

function headingInRange(heading, range) {
  return heading.start >= range.start && heading.markerEnd <= range.end;
}

function mappingIsActive(model) {
  return model.mappingSource !== null && model.mappingTarget !== null && model.mappingRange !== null;
}

function adjustedLevelBeforeMapping(model, heading) {
  return clampLevel(heading.level + model.offsets[heading.id]);
}

function mappingAffectedHeadingIds(model) {
  if (model.mappingSource === null || model.mappingRange === null) return [];
  return model.headings.filter(function (heading) {
    return headingInRange(heading, model.mappingRange) &&
      adjustedLevelBeforeMapping(model, heading) === model.mappingSource;
  }).map(function (heading) { return heading.id; });
}

function targetLevel(model, heading) {
  var level = adjustedLevelBeforeMapping(model, heading);
  if (mappingIsActive(model) && headingInRange(heading, model.mappingRange) && level === model.mappingSource) {
    return model.mappingTarget;
  }
  return level;
}

function renderMarkdown(model) {
  if (!model.headings.length) return model.baseline;
  var cursor = 0;
  var result = '';
  model.headings.forEach(function (heading) {
    result += model.baseline.slice(cursor, heading.start);
    result += '#'.repeat(targetLevel(model, heading));
    cursor = heading.markerEnd;
  });
  return result + model.baseline.slice(cursor);
}

function transformHeadings(markdown, direction) {
  var model = createState(markdown);
  var delta = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  changeOverall(model, delta, { start: 0, end: markdown.length });
  return renderMarkdown(model);
}

function changeOverall(model, delta, range) {
  model.headings.forEach(function (heading) {
    if (headingInRange(heading, range)) model.offsets[heading.id] += delta;
  });
}

function applyMapping(model, source, target, range) {
  model.mappingSource = source;
  model.mappingTarget = target;
  model.mappingRange = range;
}

function setMappingChoice(model, side, level, range) {
  var property = side === 'source' ? 'mappingSource' : 'mappingTarget';
  model[property] = model[property] === level ? null : level;
  model.mappingRange = range;
}

function clearRoundTransforms(model) {
  model.offsets.fill(0);
  model.mappingSource = null;
  model.mappingTarget = null;
  model.mappingRange = null;
}

function commitResult(model) {
  var result = renderMarkdown(model);
  establishBaseline(model, result);
  return result;
}

function resetTransformations(model) {
  establishBaseline(model, model.original);
  return model.original;
}

function getSubtreeHeadingIds(model, headingId) {
  var root = model.headings[headingId];
  if (!root) return [];
  var ids = [root.id];
  for (var index = headingId + 1; index < model.headings.length; index += 1) {
    if (model.headings[index].level <= root.level) break;
    ids.push(model.headings[index].id);
  }
  return ids;
}

function changeSubtree(model, headingId, delta) {
  getSubtreeHeadingIds(model, headingId).forEach(function (id) {
    model.offsets[id] += delta;
  });
}

function ancestorPaths(levels) {
  var active = [];
  return levels.map(function (level) {
    var path = [];
    for (var ancestorLevel = 1; ancestorLevel < level; ancestorLevel += 1) {
      path.push(Boolean(active[ancestorLevel]));
    }
    for (var clearLevel = level; clearLevel <= 6; clearLevel += 1) active[clearLevel] = false;
    active[level] = true;
    return path;
  });
}

function findRisks(model) {
  var risks = [];
  var stack = [];
  model.headings.forEach(function (heading) {
    while (stack.length && stack[stack.length - 1].level >= heading.level) stack.pop();
    var parent = stack[stack.length - 1];
    if (parent && targetLevel(model, parent) >= targetLevel(model, heading)) {
      risks.push({ parent: parent, child: heading });
    }
    stack.push(heading);
  });
  return risks;
}

var HeadingTool = {
  clampLevel: clampLevel,
  scanMarkdown: scanMarkdown,
  createState: createState,
  establishBaseline: establishBaseline,
  headingInRange: headingInRange,
  mappingIsActive: mappingIsActive,
  adjustedLevelBeforeMapping: adjustedLevelBeforeMapping,
  mappingAffectedHeadingIds: mappingAffectedHeadingIds,
  targetLevel: targetLevel,
  renderMarkdown: renderMarkdown,
  transformHeadings: transformHeadings,
  changeOverall: changeOverall,
  applyMapping: applyMapping,
  setMappingChoice: setMappingChoice,
  clearRoundTransforms: clearRoundTransforms,
  commitResult: commitResult,
  resetTransformations: resetTransformations,
  getSubtreeHeadingIds: getSubtreeHeadingIds,
  changeSubtree: changeSubtree,
  ancestorPaths: ancestorPaths,
  findRisks: findRisks
};

if (typeof window !== 'undefined') window.HeadingTool = HeadingTool;
if (typeof module !== 'undefined' && module.exports) module.exports = HeadingTool;

if (typeof document !== 'undefined') {
  var input = document.getElementById('markdown-input');
  var output = document.getElementById('markdown-output');
  var structure = document.getElementById('structure-view');
  var count = document.getElementById('heading-count');
  var riskMessage = document.getElementById('risk-message');
  var statusMessage = document.getElementById('status-message');
  var mappingStatus = document.getElementById('mapping-status');
  var analysisPanel = document.getElementById('analysis-panel');
  var structureToggle = document.getElementById('structure-toggle');
  var sourceLevels = document.getElementById('source-levels');
  var targetLevels = document.getElementById('target-levels');
  var state = createState('');
  var lastImpact = null;

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function currentRange() {
    return input.selectionStart === input.selectionEnd
      ? { start: 0, end: state.baseline.length, selected: false }
      : { start: input.selectionStart, end: input.selectionEnd, selected: true };
  }

  function setStatus(message) {
    statusMessage.textContent = message;
  }

  function setImpact(type, ids) {
    lastImpact = { type: type, ids: ids.slice() };
  }

  function clearImpact() {
    lastImpact = null;
  }

  function renderPath(path) {
    return '<span class="dot-path" style="--path-count:' + path.length + '" aria-label="' + path.map(function (present, index) {
      return 'H' + (index + 1) + (present ? ' 存在' : ' 缺失');
    }).join('，') + '">' + path.map(function (present) {
      return '<span class="path-dot ' + (present ? 'present' : 'missing') + '">' +
        (present ? '●' : '○') + '</span>';
    }).join('') + '</span>';
  }

  function outlineCell(text, level, path, changed, headingId, withActions, impactClass, continues) {
    var actions = withActions
      ? '<span class="branch-actions"><button type="button" data-action="subtree-up" data-heading-id="' + headingId +
        '" title="当前标题及子树提升一级" aria-label="提升“' + text + '”及其子树">↑</button>' +
        '<button type="button" data-action="subtree-down" data-heading-id="' + headingId +
        '" title="当前标题及子树降低一级" aria-label="降低“' + text + '”及其子树">↓</button></span>'
      : '';
    return '<div class="outline-cell level-' + level + (changed ? ' is-changed' : '') +
      (impactClass ? ' ' + impactClass : '') +
      '"><div class="outline-node">' + renderPath(path) +
      '<span class="current-node' + (continues ? ' continues' : '') + '" aria-hidden="true"></span>' +
      '<span class="outline-text" title="' + text + '">' + text + '</span>' +
      '<span class="level-name">H' + level + '</span>' + actions + '</div></div>';
  }

  function renderMappingControls() {
    [sourceLevels, targetLevels].forEach(function (strip, stripIndex) {
      var active = stripIndex === 0 ? state.mappingSource : state.mappingTarget;
      Array.prototype.forEach.call(strip.querySelectorAll('button'), function (button) {
        var selected = Number(button.dataset.level) === active;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
    });
    mappingStatus.textContent = mappingIsActive(state)
      ? '实时转换：H' + state.mappingSource + ' → H' + state.mappingTarget
      : '请选择原层级和目标层级；只选择一侧时不会转换。';
  }

  function render() {
    output.value = renderMarkdown(state);
    count.textContent = state.headings.length + ' 个标题';
    renderMappingControls();

    if (!state.headings.length) {
      structure.innerHTML = '<p class="empty-state">未发现符合规则的 ATX 标题。</p>';
    } else {
      var beforeLevels = state.headings.map(function (heading) { return heading.level; });
      var afterLevels = state.headings.map(function (heading) { return targetLevel(state, heading); });
      var beforePaths = ancestorPaths(beforeLevels);
      var afterPaths = ancestorPaths(afterLevels);
      structure.innerHTML = '<div class="outline-header"><span>当前基准 / 转换前</span><span>当前结果 / 转换后</span></div>' +
        '<ol class="outline-rows">' + state.headings.map(function (heading, index) {
          var target = afterLevels[index];
          var changed = target !== heading.level;
          var text = escapeHtml(heading.text || '（空标题）');
          var affected = lastImpact && lastImpact.ids.indexOf(heading.id) !== -1;
          var beforeImpact = affected ? 'impact impact-' + lastImpact.type + ' impact-before' : '';
          var showResultImpact = affected && (lastImpact.type !== 'mapping' || mappingIsActive(state));
          var afterImpact = showResultImpact ? 'impact impact-' + lastImpact.type + ' impact-after' : '';
          var beforeContinues = Boolean(beforePaths[index + 1] && beforePaths[index + 1][heading.level - 1]);
          var afterContinues = Boolean(afterPaths[index + 1] && afterPaths[index + 1][target - 1]);
          return '<li class="outline-row">' +
            outlineCell(text, heading.level, beforePaths[index], false, heading.id, false, beforeImpact, beforeContinues) +
            outlineCell(text, target, afterPaths[index], changed, heading.id, true, afterImpact, afterContinues) + '</li>';
        }).join('') + '</ol>';
    }

    var risks = findRisks(state);
    riskMessage.hidden = risks.length === 0;
    if (risks.length) {
      var example = risks[0];
      riskMessage.textContent = '发现 ' + risks.length + ' 处可能的层级倒置：例如“' +
        (example.parent.text || '空标题') + '”转换后为 H' + targetLevel(state, example.parent) +
        '，不再高于子标题“' + (example.child.text || '空标题') + '”的 H' +
        targetLevel(state, example.child) + '。转换仍可继续。';
    } else {
      riskMessage.textContent = '';
    }
  }

  function operate(action, wholeMessage, selectedMessage) {
    var range = currentRange();
    action(range);
    render();
    input.focus();
    if (range.selected) input.setSelectionRange(range.start, range.end);
    setStatus(range.selected ? selectedMessage : wholeMessage);
  }

  input.addEventListener('input', function () {
    state = createState(input.value);
    clearImpact();
    render();
    setStatus(state.headings.length ? '已根据新输入建立新的 Original 和 Baseline' : '');
  });

  function operateOverall(delta, range) {
    var ids = state.headings.filter(function (heading) {
      return headingInRange(heading, range);
    }).map(function (heading) { return heading.id; });
    changeOverall(state, delta, range);
    setImpact('overall', ids);
  }

  document.getElementById('promote-button').addEventListener('click', function () {
    operate(function (range) { operateOverall(-1, range); }, '已整体提升一级', '已提升选区内标题');
  });

  document.getElementById('demote-button').addEventListener('click', function () {
    operate(function (range) { operateOverall(1, range); }, '已整体降低一级', '已降低选区内标题');
  });

  function handleLevelChoice(side, event) {
    var button = event.target.closest('button[data-level]');
    if (!button) return;
    var range = currentRange();
    setMappingChoice(state, side, Number(button.dataset.level), range);
    if (state.mappingSource === null) {
      clearImpact();
    } else {
      setImpact('mapping', mappingAffectedHeadingIds(state));
    }
    render();
    setStatus(mappingIsActive(state) ? '指定层级转换已实时生效' : '指定层级转换当前未生效');
  }

  sourceLevels.addEventListener('click', function (event) { handleLevelChoice('source', event); });
  targetLevels.addEventListener('click', function (event) { handleLevelChoice('target', event); });

  structure.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-action]');
    if (!button) return;
    var headingId = Number(button.dataset.headingId);
    var delta = button.dataset.action === 'subtree-up' ? -1 : 1;
    var ids = getSubtreeHeadingIds(state, headingId);
    changeSubtree(state, headingId, delta);
    setImpact('subtree', ids);
    render();
    setStatus('已将“' + (state.headings[headingId].text || '空标题') + '”及其子树' +
      (delta < 0 ? '提升' : '降低') + '一级');
  });

  document.getElementById('continue-button').addEventListener('click', function () {
    var result = commitResult(state);
    clearImpact();
    input.value = result;
    input.setSelectionRange(0, 0);
    render();
    input.focus();
    setStatus('当前结果已成为新的 Baseline；Original 保持不变');
  });

  document.getElementById('reset-button').addEventListener('click', function () {
    var original = resetTransformations(state);
    clearImpact();
    input.value = original;
    input.setSelectionRange(0, 0);
    render();
    input.focus();
    setStatus('已恢复本次最初输入的 Original');
  });

  structureToggle.addEventListener('click', function () {
    var collapsed = analysisPanel.classList.toggle('is-collapsed');
    structureToggle.setAttribute('aria-expanded', String(!collapsed));
    structureToggle.textContent = collapsed ? '展开' : '收起';
  });

  document.getElementById('copy-button').addEventListener('click', async function () {
    if (!output.value) {
      setStatus('没有可复制的内容');
      return;
    }
    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('已复制结果');
    } catch (error) {
      output.focus();
      output.select();
      setStatus('复制失败，请手动复制已选中的结果');
    }
  });

  document.getElementById('clear-button').addEventListener('click', function () {
    input.value = '';
    state = createState('');
    clearImpact();
    render();
    setStatus('');
    input.focus();
  });

  render();
}

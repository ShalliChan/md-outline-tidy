'use strict';

var DEFAULT_PRESETS = [
  { id: 'default-16', name: '16px 正文', fontSize: 16, bold: false, builtIn: true },
  { id: 'default-19', name: '19px 正文', fontSize: 19, bold: false, builtIn: true },
  { id: 'default-16-bold', name: '16px 加粗', fontSize: 16, bold: true, builtIn: true },
  { id: 'default-19-bold', name: '19px 加粗', fontSize: 19, bold: true, builtIn: true }
];

function clampLevel(level) {
  return Math.max(1, Math.min(6, level));
}

function cloneMetadata(metadata) {
  var copy = {};
  Object.keys(metadata || {}).forEach(function (key) {
    copy[key] = Object.assign({}, metadata[key]);
  });
  return copy;
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
    baselineMetadata: {},
    markdown: markdown,
    headings: [],
    offsets: [],
    mappingSource: null,
    mappingSourceMode: 'single',
    mappingHeadingId: null,
    mappingTarget: null,
    mappingPreset: null,
    mappingRange: null,
    roundText: null,
    roundMetadata: null
  };
  establishBaseline(state, markdown, {});
  return state;
}

function establishBaseline(model, markdown, metadata) {
  model.baseline = markdown;
  model.baselineMetadata = cloneMetadata(metadata);
  model.markdown = markdown;
  model.headings = scanMarkdown(markdown);
  model.offsets = model.headings.map(function () { return 0; });
  model.mappingSource = null;
  model.mappingSourceMode = 'single';
  model.mappingHeadingId = null;
  model.mappingTarget = null;
  model.mappingPreset = null;
  model.mappingRange = null;
  model.roundText = null;
  model.roundMetadata = null;
  return model;
}

function headingInRange(heading, range) {
  return heading.start >= range.start && heading.markerEnd <= range.end;
}

function mappingIsActive(model) {
  return model.mappingSource !== null && model.mappingRange !== null &&
    (model.mappingTarget !== null || model.mappingPreset !== null);
}

function adjustedLevelBeforeMapping(model, heading) {
  return clampLevel(heading.level + model.offsets[heading.id]);
}

function headingMatchesSource(model, heading) {
  if (model.mappingSource === null || !headingInRange(heading, model.mappingRange)) return false;
  if (model.mappingSourceMode === 'exact') return heading.id === model.mappingHeadingId;
  if (model.mappingSourceMode === 'and-below') {
    return branchSourceHeadingIds(model).indexOf(heading.id) !== -1;
  }
  var level = adjustedLevelBeforeMapping(model, heading);
  return level === model.mappingSource;
}

function branchSourceHeadingIds(model) {
  if (model.mappingSource === null || model.mappingRange === null) return [];
  var ids = [];
  var insideBranch = false;
  model.headings.forEach(function (heading) {
    if (!headingInRange(heading, model.mappingRange)) {
      insideBranch = false;
      return;
    }
    var level = adjustedLevelBeforeMapping(model, heading);
    if (level < model.mappingSource) {
      insideBranch = false;
    } else if (level === model.mappingSource) {
      insideBranch = true;
      ids.push(heading.id);
    } else if (insideBranch) {
      ids.push(heading.id);
    }
  });
  return ids;
}

function mappingAffectedHeadingIds(model) {
  if (model.mappingSource === null || model.mappingRange === null) return [];
  return model.headings.filter(function (heading) {
    return headingMatchesSource(model, heading);
  }).map(function (heading) { return heading.id; });
}

function headingConvertsToBody(model, heading) {
  return mappingIsActive(model) && model.mappingPreset !== null &&
    headingMatchesSource(model, heading);
}

function targetLevel(model, heading) {
  var level = adjustedLevelBeforeMapping(model, heading);
  if (mappingIsActive(model) && model.mappingTarget !== null && headingMatchesSource(model, heading)) {
    return clampLevel(model.mappingTarget +
      (model.mappingSourceMode === 'and-below' ? level - model.mappingSource : 0));
  }
  return level;
}

function renderResult(model) {
  if (model.roundText !== null) {
    return { text: model.roundText, metadata: cloneMetadata(model.roundMetadata), convertedHeadingIds: [] };
  }
  var metadata = cloneMetadata(model.baselineMetadata);
  if (!model.headings.length) return { text: model.baseline, metadata: metadata, convertedHeadingIds: [] };
  var cursor = 0;
  var text = '';
  var converted = [];
  model.headings.forEach(function (heading) {
    text += model.baseline.slice(cursor, heading.start);
    if (headingConvertsToBody(model, heading)) {
      var preset = model.mappingPreset;
      text += preset.bold ? '**' + heading.text + '**' : heading.text;
      metadata[heading.lineIndex] = {
        kind: 'body',
        fontSize: preset.fontSize,
        bold: Boolean(preset.bold),
        presetId: preset.id,
        presetName: preset.name
      };
      cursor = heading.end;
      converted.push(heading.id);
    } else {
      text += '#'.repeat(targetLevel(model, heading));
      cursor = heading.markerEnd;
    }
  });
  text += model.baseline.slice(cursor);
  return { text: text, metadata: metadata, convertedHeadingIds: converted };
}

function renderMarkdown(model) {
  return renderResult(model).text;
}

function transformHeadings(markdown, direction) {
  var model = createState(markdown);
  changeOverall(model, direction === 'up' ? -1 : direction === 'down' ? 1 : 0, { start: 0, end: markdown.length });
  return renderMarkdown(model);
}

function changeOverall(model, delta, range) {
  model.headings.forEach(function (heading) {
    if (headingInRange(heading, range)) model.offsets[heading.id] += delta;
  });
}

function applyMapping(model, source, target, range, sourceMode) {
  model.mappingSource = source;
  model.mappingSourceMode = sourceMode || 'single';
  model.mappingHeadingId = null;
  model.mappingTarget = target;
  model.mappingPreset = null;
  model.mappingRange = range;
}

function applyPresetMapping(model, source, preset, range, sourceMode) {
  model.mappingSource = source;
  model.mappingSourceMode = sourceMode || 'single';
  model.mappingHeadingId = null;
  model.mappingTarget = null;
  model.mappingPreset = Object.assign({}, preset);
  model.mappingRange = range;
}

function setMappingChoice(model, side, value, range) {
  if (side === 'source') {
    setSourceChoice(model, value, 'single', range);
    return;
  } else {
    model.mappingTarget = model.mappingTarget === value && model.mappingPreset === null ? null : value;
    model.mappingPreset = null;
  }
  model.mappingRange = range;
}

function setSourceChoice(model, level, mode, range) {
  var normalizedMode = mode === 'and-below' ? 'and-below' : 'single';
  var isActive = model.mappingSource === level && model.mappingSourceMode === normalizedMode;
  model.mappingSource = isActive ? null : level;
  model.mappingSourceMode = normalizedMode;
  model.mappingHeadingId = null;
  model.mappingRange = range;
}

function setExactSourceChoice(model, headingId, range) {
  var heading = model.headings[headingId];
  if (!heading) return;
  var isActive = model.mappingSourceMode === 'exact' && model.mappingHeadingId === headingId;
  model.mappingSource = isActive ? null : adjustedLevelBeforeMapping(model, heading);
  model.mappingSourceMode = 'exact';
  model.mappingHeadingId = isActive ? null : headingId;
  model.mappingRange = range;
}

function setPresetChoice(model, preset, range) {
  model.mappingPreset = model.mappingPreset && model.mappingPreset.id === preset.id ? null : Object.assign({}, preset);
  model.mappingTarget = null;
  model.mappingRange = range;
}

function clearRoundTransforms(model) {
  model.offsets.fill(0);
  model.mappingSource = null;
  model.mappingSourceMode = 'single';
  model.mappingHeadingId = null;
  model.mappingTarget = null;
  model.mappingPreset = null;
  model.mappingRange = null;
  model.roundText = null;
  model.roundMetadata = null;
}

function commitResult(model) {
  var result = renderResult(model);
  establishBaseline(model, result.text, result.metadata);
  return result.text;
}

function resetTransformations(model) {
  establishBaseline(model, model.original, {});
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
  getSubtreeHeadingIds(model, headingId).forEach(function (id) { model.offsets[id] += delta; });
}

function ancestorPaths(levels) {
  var active = [];
  return levels.map(function (level) {
    var path = [];
    for (var ancestorLevel = 1; ancestorLevel < level; ancestorLevel += 1) path.push(Boolean(active[ancestorLevel]));
    for (var clearLevel = level; clearLevel <= 6; clearLevel += 1) active[clearLevel] = false;
    active[level] = true;
    return path;
  });
}

function ancestorContinuations(paths) {
  return paths.map(function (path, rowIndex) {
    var nextPath = paths[rowIndex + 1] || [];
    return path.map(function (present, axisIndex) { return Boolean(present && nextPath[axisIndex]); });
  });
}

function findRisks(model) {
  var risks = [];
  var stack = [];
  model.headings.filter(function (heading) { return !headingConvertsToBody(model, heading); }).forEach(function (heading) {
    while (stack.length && stack[stack.length - 1].level >= heading.level) stack.pop();
    var parent = stack[stack.length - 1];
    if (parent && targetLevel(model, parent) >= targetLevel(model, heading)) risks.push({ parent: parent, child: heading });
    stack.push(heading);
  });
  return risks;
}

function findBodyConversionRisks(model) {
  return mappingAffectedHeadingIds(model).filter(function (id) {
    if (!model.mappingPreset) return false;
    return getSubtreeHeadingIds(model, id).length > 1;
  }).map(function (id) { return model.headings[id]; });
}

function dynamicSourceLevels(model, range) {
  var levels = {};
  model.headings.forEach(function (heading) {
    if (headingInRange(heading, range)) levels[adjustedLevelBeforeMapping(model, heading)] = true;
  });
  var sorted = Object.keys(levels).map(Number).sort(function (a, b) { return a - b; });
  return {
    lowest: sorted.length ? sorted[sorted.length - 1] : null,
    secondLowest: sorted.length > 1 ? sorted[sorted.length - 2] : null
  };
}

function isThematicBreak(line) {
  return /^ {0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/.test(line);
}

function fenceStep(line, fence) {
  if (fence) {
    var closing = line.match(/^ {0,3}(`+|~+)[ \t]*$/);
    return closing && closing[1][0] === fence.character && closing[1].length >= fence.length ? null : fence;
  }
  var opening = line.match(/^ {0,3}(`{3,}|~{3,})/);
  return opening ? { character: opening[1][0], length: opening[1].length } : null;
}

function removeThematicBreaks(markdown) {
  var fence = null;
  var output = [];
  markdown.split('\n').forEach(function (line) {
    var wasInFence = Boolean(fence);
    var nextFence = fenceStep(line, fence);
    var isFenceLine = nextFence !== fence;
    if (!wasInFence && !isFenceLine && isThematicBreak(line)) return;
    if (!(line === '' && output.length && output[output.length - 1] === '')) output.push(line);
    fence = nextFence;
  });
  return output.join('\n');
}

function isSpecialBlock(line, inFence) {
  if (inFence || !line.trim()) return true;
  return /^(#{1,6}) |^ {0,3}(`{3,}|~{3,})|^\s*(?:[-+*]|\d+[.)])\s+|^\s*>|^\s*\|.*\||^ {4}|^\t/.test(line) ||
    isThematicBreak(line);
}

function visibleLength(line) {
  return line.replace(/[`*_~\[\]()]/g, '').trim().length;
}

function isGuideLine(line) {
  return !isSpecialBlock(line, false) && visibleLength(line) <= 24 && /[：:]\s*$/.test(line);
}

function compressGuideLines(markdown) {
  var lines = markdown.split('\n');
  var result = [];
  var fence = null;
  for (var index = 0; index < lines.length; index += 1) {
    var line = lines[index];
    var wasInFence = Boolean(fence);
    var nextFence = fenceStep(line, fence);
    var isFenceLine = nextFence !== fence;
    if (!wasInFence && !isFenceLine && isGuideLine(line)) {
      var combined = line.trimEnd();
      var cursor = index + 1;
      var merged = false;
      var lastConsumed = index;
      while (cursor < lines.length) {
        while (cursor < lines.length && !lines[cursor].trim()) cursor += 1;
        if (cursor >= lines.length || !isGuideLine(lines[cursor])) break;
        combined += lines[cursor].trim();
        lastConsumed = cursor;
        cursor += 1;
        merged = true;
      }
      if (merged) {
        result.push(combined);
        index = lastConsumed;
        fence = nextFence;
        continue;
      }
    }
    result.push(line);
    fence = nextFence;
  }
  return result.join('\n');
}

function mergeShortParagraphs(markdown) {
  return compressGuideLines(markdown);
}

function remapMetadataByContent(oldText, newText, metadata) {
  var oldLines = oldText.split('\n');
  var newLines = newText.split('\n');
  var mapped = {};
  var searchFrom = 0;
  Object.keys(metadata || {}).map(Number).sort(function (a, b) { return a - b; }).forEach(function (oldIndex) {
    var oldLine = oldLines[oldIndex];
    for (var newIndex = searchFrom; newIndex < newLines.length; newIndex += 1) {
      if (newLines[newIndex] === oldLine) {
        mapped[newIndex] = Object.assign({}, metadata[oldIndex]);
        searchFrom = newIndex + 1;
        return;
      }
    }
  });
  return mapped;
}

function applyTextResult(model, text) {
  var metadata = remapMetadataByContent(model.baseline, text, model.baselineMetadata);
  clearRoundTransforms(model);
  model.roundText = text;
  model.roundMetadata = metadata;
  return text;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (character) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
  });
}

function inlineMarkdown(value) {
  var escaped = escapeHtml(value);
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return escaped;
}

function markdownToHtml(markdown, metadata) {
  var lines = markdown.split('\n');
  var html = [];
  var fence = null;
  var codeLines = [];
  var listType = null;
  function closeList() {
    if (listType) html.push('</' + listType + '>');
    listType = null;
  }
  lines.forEach(function (line, lineIndex) {
    if (fence) {
      var closingFence = fenceStep(line, fence);
      if (closingFence === null) {
        html.push('<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
        codeLines = [];
        fence = null;
      } else {
        codeLines.push(line);
      }
      return;
    }
    var opened = fenceStep(line, null);
    if (opened) {
      closeList();
      fence = opened;
      return;
    }
    var annotation = metadata && metadata[lineIndex];
    if (annotation) {
      closeList();
      html.push('<p style="margin:0;font-size:' + annotation.fontSize + 'px;font-weight:' +
        (annotation.bold ? '700' : '400') + ';">' + inlineMarkdown(line) + '</p>');
      return;
    }
    var heading = line.match(/^(#{1,6}) (.*)$/);
    if (heading) {
      closeList();
      html.push('<h' + heading[1].length + '>' + inlineMarkdown(heading[2]) + '</h' + heading[1].length + '>');
      return;
    }
    var unordered = line.match(/^\s*[-+*]\s+(.*)$/);
    var ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (unordered || ordered) {
      var desired = unordered ? 'ul' : 'ol';
      if (listType !== desired) { closeList(); listType = desired; html.push('<' + desired + '>'); }
      html.push('<li>' + inlineMarkdown((unordered || ordered)[1]) + '</li>');
      return;
    }
    closeList();
    if (/^\s*>/.test(line)) html.push('<blockquote>' + inlineMarkdown(line.replace(/^\s*>\s?/, '')) + '</blockquote>');
    else if (isThematicBreak(line)) html.push('<hr>');
    else if (!line.trim()) html.push('<p><br></p>');
    else html.push('<p>' + inlineMarkdown(line) + '</p>');
  });
  closeList();
  if (fence) html.push('<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
  return html.join('');
}

function createClipboardPayload(model) {
  var result = renderResult(model);
  var hasRich = Object.keys(result.metadata).length > 0;
  return {
    plain: result.text,
    html: hasRich ? markdownToHtml(result.text, result.metadata) : null,
    hasRich: hasRich
  };
}

function combinePresets(custom) {
  return DEFAULT_PRESETS.concat(custom || []);
}

function continueStateWithoutNavigation(model, editor) {
  var result = commitResult(model);
  editor.value = result;
  return result;
}

function resetStateWithoutNavigation(model, editor) {
  var original = resetTransformations(model);
  editor.value = original;
  return original;
}

function bodyGhostHtml(heading, impactClass) {
  return '<div class="outline-cell body-ghost is-changed' + (impactClass ? ' ' + impactClass : '') +
    '"><div class="body-ghost-content"><span class="outline-text">' +
    escapeHtml(heading.text || '（空标题）') + '</span></div></div>';
}

var HeadingTool = {
  DEFAULT_PRESETS: DEFAULT_PRESETS,
  clampLevel: clampLevel,
  cloneMetadata: cloneMetadata,
  scanMarkdown: scanMarkdown,
  createState: createState,
  establishBaseline: establishBaseline,
  headingInRange: headingInRange,
  mappingIsActive: mappingIsActive,
  adjustedLevelBeforeMapping: adjustedLevelBeforeMapping,
  headingMatchesSource: headingMatchesSource,
  branchSourceHeadingIds: branchSourceHeadingIds,
  mappingAffectedHeadingIds: mappingAffectedHeadingIds,
  headingConvertsToBody: headingConvertsToBody,
  targetLevel: targetLevel,
  renderResult: renderResult,
  renderMarkdown: renderMarkdown,
  transformHeadings: transformHeadings,
  changeOverall: changeOverall,
  applyMapping: applyMapping,
  applyPresetMapping: applyPresetMapping,
  setMappingChoice: setMappingChoice,
  setSourceChoice: setSourceChoice,
  setExactSourceChoice: setExactSourceChoice,
  setPresetChoice: setPresetChoice,
  clearRoundTransforms: clearRoundTransforms,
  commitResult: commitResult,
  resetTransformations: resetTransformations,
  getSubtreeHeadingIds: getSubtreeHeadingIds,
  changeSubtree: changeSubtree,
  ancestorPaths: ancestorPaths,
  ancestorContinuations: ancestorContinuations,
  findRisks: findRisks,
  findBodyConversionRisks: findBodyConversionRisks,
  dynamicSourceLevels: dynamicSourceLevels,
  isThematicBreak: isThematicBreak,
  removeThematicBreaks: removeThematicBreaks,
  isGuideLine: isGuideLine,
  compressGuideLines: compressGuideLines,
  mergeShortParagraphs: mergeShortParagraphs,
  remapMetadataByContent: remapMetadataByContent,
  applyTextResult: applyTextResult,
  markdownToHtml: markdownToHtml,
  createClipboardPayload: createClipboardPayload,
  combinePresets: combinePresets,
  continueStateWithoutNavigation: continueStateWithoutNavigation,
  resetStateWithoutNavigation: resetStateWithoutNavigation,
  bodyGhostHtml: bodyGhostHtml
};

if (typeof window !== 'undefined') window.HeadingTool = HeadingTool;
if (typeof module !== 'undefined' && module.exports) module.exports = HeadingTool;

if (typeof document !== 'undefined' && document.getElementById('markdown-input')) {
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
  var presetTargets = document.getElementById('preset-targets');
  var presetEditor = document.getElementById('preset-editor');
  var lowestButton = document.getElementById('lowest-level');
  var secondLowestButton = document.getElementById('second-lowest-level');
  var state = createState('');
  var lastImpact = null;
  var customPresets = loadCustomPresets();

  function safeStorageGet(key, fallback) {
    try {
      var value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (error) { /* Storage may be unavailable on file://. */ }
  }

  function loadCustomPresets() {
    try {
      var parsed = JSON.parse(safeStorageGet('markdown-tool-body-presets', '[]'));
      return Array.isArray(parsed) ? parsed.filter(function (preset) {
        return preset && preset.id && preset.name && Number(preset.fontSize) > 0;
      }) : [];
    } catch (error) {
      return [];
    }
  }

  function allPresets() {
    return combinePresets(customPresets);
  }

  function savePresets() {
    safeStorageSet('markdown-tool-body-presets', JSON.stringify(customPresets));
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

  function autoSizeEditors() {
    var maximum = Math.max(260, Math.min(window.innerHeight * 0.65, 720));
    [input, output].forEach(function (editor) {
      editor.style.height = 'auto';
      editor.style.height = Math.min(maximum, Math.max(150, editor.scrollHeight)) + 'px';
      editor.style.overflowY = editor.scrollHeight > maximum ? 'auto' : 'hidden';
    });
  }

  function renderPath(path, continuations) {
    return '<span class="dot-path" style="--path-count:' + path.length + '" aria-label="' +
      path.map(function (present, index) { return 'H' + (index + 1) + (present ? ' 存在' : ' 缺失'); }).join('，') +
      '">' + path.map(function (present, index) {
        return '<span class="path-dot ' + (present ? 'present' : 'missing') +
          (continuations[index] ? ' path-continues' : ' path-ends') + '">' + (present ? '●' : '○') + '</span>';
      }).join('') + '</span>';
  }

  function outlineCell(text, level, path, continuations, changed, headingId, actionsEnabled, impactClass, continues, exactSourceEnabled) {
    var actions = actionsEnabled
      ? '<span class="branch-actions"><button type="button" data-action="subtree-up" data-heading-id="' + headingId +
        '" title="当前标题及子树提升一级">↑</button><button type="button" data-action="subtree-down" data-heading-id="' +
        headingId + '" title="当前标题及子树降低一级">↓</button></span>' : '';
    var exactSource = exactSourceEnabled
      ? '<button type="button" class="exact-source-button" data-action="source-only" data-heading-id="' + headingId +
        '" aria-label="仅选择当前标题作为源" title="仅选择当前这一条标题">仅此</button>' : '';
    return '<div class="outline-cell level-' + level + (changed ? ' is-changed' : '') +
      (impactClass ? ' ' + impactClass : '') + '"><div class="outline-node">' +
      renderPath(path, continuations) +
      '<span class="current-node' + (continues ? ' continues' : '') + '" aria-hidden="true"></span>' +
      '<span class="outline-text" title="' + text + '">' + text + '</span>' +
      '<span class="level-name">H' + level + '</span>' + exactSource + actions + '</div></div>';
  }

  function renderPresetControls() {
    var presets = allPresets();
    presetTargets.innerHTML = presets.map(function (preset) {
      var active = state.mappingPreset && state.mappingPreset.id === preset.id;
      return '<button type="button" data-preset-id="' + escapeHtml(preset.id) + '" class="' +
        (active ? 'active' : '') + '" aria-pressed="' + String(Boolean(active)) + '">' +
        escapeHtml(preset.name) + '</button>';
    }).join('');
    presetEditor.innerHTML = DEFAULT_PRESETS.map(function (preset) {
      return '<div class="preset-edit-row built-in"><span>' + escapeHtml(preset.name) +
        '</span><span>' + preset.fontSize + 'px' + (preset.bold ? ' · 加粗' : '') + '</span></div>';
    }).concat(customPresets.map(function (preset) {
      return '<div class="preset-edit-row" data-edit-preset="' + escapeHtml(preset.id) + '">' +
        '<input data-field="name" value="' + escapeHtml(preset.name) + '" aria-label="预设名称">' +
        '<input data-field="fontSize" type="number" min="8" max="96" value="' + preset.fontSize + '" aria-label="字号">' +
        '<label><input data-field="bold" type="checkbox"' + (preset.bold ? ' checked' : '') + '> 加粗</label>' +
        '<button type="button" data-delete-preset="' + escapeHtml(preset.id) + '">删除</button></div>';
    })).join('');
  }

  function renderMappingControls() {
    Array.prototype.forEach.call(sourceLevels.querySelectorAll('button[data-level]'), function (button) {
      var buttonMode = button.dataset.sourceMode || 'single';
      var selected = Number(button.dataset.level) === state.mappingSource && buttonMode === state.mappingSourceMode;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    Array.prototype.forEach.call(targetLevels.querySelectorAll('button[data-level]'), function (button) {
      var selected = Number(button.dataset.level) === state.mappingTarget && state.mappingPreset === null;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    var dynamic = dynamicSourceLevels(state, currentRange());
    lowestButton.disabled = dynamic.lowest === null;
    lowestButton.dataset.level = dynamic.lowest === null ? '' : dynamic.lowest;
    lowestButton.textContent = dynamic.lowest === null ? '最低层级' : '最低层级 H' + dynamic.lowest;
    secondLowestButton.disabled = dynamic.secondLowest === null;
    secondLowestButton.dataset.level = dynamic.secondLowest === null ? '' : dynamic.secondLowest;
    secondLowestButton.textContent = dynamic.secondLowest === null ? '倒数第二层级' : '倒数第二层级 H' + dynamic.secondLowest;
    [lowestButton, secondLowestButton].forEach(function (button) {
      button.classList.toggle('active', !button.disabled && Number(button.dataset.level) === state.mappingSource &&
        state.mappingSourceMode === 'single');
    });
    renderPresetControls();
    if (mappingIsActive(state)) {
      var sourceLabel = state.mappingSourceMode === 'exact'
        ? '仅此：' + (state.headings[state.mappingHeadingId].text || '空标题')
        : 'H' + state.mappingSource + (state.mappingSourceMode === 'and-below' ? '+' : '');
      mappingStatus.textContent = '实时转换：' + sourceLabel + ' → ' +
        (state.mappingPreset ? state.mappingPreset.name + ' 正文' : 'H' + state.mappingTarget);
    } else {
      mappingStatus.textContent = '请选择源层级和一个目标；只选择一侧时不会转换。';
    }
  }

  function render() {
    var result = renderResult(state);
    output.value = result.text;
    count.textContent = state.headings.length + ' 个标题';
    renderMappingControls();
    if (!state.headings.length) {
      structure.innerHTML = '<p class="empty-state">未发现符合规则的 ATX 标题。</p>';
    } else {
      var remaining = state.headings.filter(function (heading) { return !headingConvertsToBody(state, heading); });
      var beforePaths = ancestorPaths(state.headings.map(function (heading) { return heading.level; }));
      var beforeContinuations = ancestorContinuations(beforePaths);
      var remainingPaths = ancestorPaths(remaining.map(function (heading) { return targetLevel(state, heading); }));
      var remainingContinuations = ancestorContinuations(remainingPaths);
      var afterPathById = {};
      remaining.forEach(function (heading, index) {
        afterPathById[heading.id] = { path: remainingPaths[index], continuation: remainingContinuations[index], index: index };
      });
      structure.innerHTML = '<div class="outline-header"><span>当前基准 / 转换前</span><span>当前结果 / 转换后</span></div>' +
        '<ol class="outline-rows">' + state.headings.map(function (heading, index) {
          var affected = lastImpact && lastImpact.ids.indexOf(heading.id) !== -1;
          var beforeImpact = affected ? 'impact impact-' + lastImpact.type + ' impact-before' : '';
          var showAfter = affected && (lastImpact.type !== 'mapping' || mappingIsActive(state));
          var afterImpact = showAfter ? 'impact impact-' + lastImpact.type + ' impact-after' : '';
          var beforeContinues = Boolean(beforePaths[index + 1] && beforePaths[index + 1][heading.level - 1]);
          var before = outlineCell(escapeHtml(heading.text || '（空标题）'), heading.level, beforePaths[index],
            beforeContinuations[index], false, heading.id, false, beforeImpact, beforeContinues, true);
          if (headingConvertsToBody(state, heading)) {
            return '<li class="outline-row">' + before + bodyGhostHtml(heading, afterImpact) + '</li>';
          }
          var info = afterPathById[heading.id];
          var target = targetLevel(state, heading);
          var nextRemaining = remaining[info.index + 1];
          var afterContinues = Boolean(nextRemaining && info.path && afterPathById[nextRemaining.id].path[target - 1]);
          return '<li class="outline-row">' + before +
            outlineCell(escapeHtml(heading.text || '（空标题）'), target, info.path, info.continuation,
              target !== heading.level, heading.id, true, afterImpact, afterContinues, false) + '</li>';
        }).join('') + '</ol>';
    }
    var inversionRisks = findRisks(state);
    var bodyRisks = findBodyConversionRisks(state);
    var messages = [];
    if (inversionRisks.length) messages.push('发现 ' + inversionRisks.length + ' 处可能的层级倒置。');
    if (bodyRisks.length) messages.push('转换为正文后，' + bodyRisks.length + ' 个标题下仍存在子标题，原父级结构将消失。');
    riskMessage.hidden = messages.length === 0;
    riskMessage.textContent = messages.join(' ') + (messages.length ? ' 转换仍可继续。' : '');
    autoSizeEditors();
  }

  function updateMappingImpact() {
    if (state.mappingSource === null) clearImpact();
    else setImpact('mapping', mappingAffectedHeadingIds(state));
  }

  function chooseSource(level, mode) {
    var range = currentRange();
    setSourceChoice(state, level, mode || 'single', range);
    updateMappingImpact();
    render();
    setStatus(mappingIsActive(state) ? '指定转换已实时生效' : '源层级已更新；请选择目标');
  }

  function writeRichSelectionFallback(html) {
    var holder = document.createElement('div');
    holder.contentEditable = 'true';
    holder.setAttribute('aria-hidden', 'true');
    holder.style.position = 'fixed';
    holder.style.left = '-9999px';
    holder.innerHTML = html;
    document.body.appendChild(holder);
    var selection = window.getSelection();
    var range = document.createRange();
    range.selectNodeContents(holder);
    selection.removeAllRanges();
    selection.addRange(range);
    var copied = document.execCommand('copy');
    selection.removeAllRanges();
    holder.remove();
    if (!copied) throw new Error('富文本回退复制失败');
  }

  input.addEventListener('input', function () {
    state = createState(input.value);
    clearImpact();
    render();
    setStatus(state.headings.length ? '已根据新输入建立新的 Original 和 Baseline；旧正文样式已安全清除' : '');
  });

  sourceLevels.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-level]');
    if (!button) return;
    chooseSource(Number(button.dataset.level), button.dataset.sourceMode || 'single');
  });

  [lowestButton, secondLowestButton].forEach(function (button) {
    button.addEventListener('click', function () {
      if (button.disabled || !button.dataset.level) return;
      chooseSource(Number(button.dataset.level), 'single');
    });
  });

  targetLevels.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-level]');
    if (!button) return;
    var range = currentRange();
    setMappingChoice(state, 'target', Number(button.dataset.level), range);
    updateMappingImpact();
    render();
    setStatus(mappingIsActive(state) ? '标题层级转换已实时生效' : '目标层级已更新；请选择源');
  });

  presetTargets.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-preset-id]');
    if (!button) return;
    var preset = allPresets().find(function (item) { return item.id === button.dataset.presetId; });
    if (!preset) return;
    setPresetChoice(state, preset, currentRange());
    updateMappingImpact();
    render();
    setStatus(mappingIsActive(state) ? '标题转正文已实时生效' : '正文预设已更新；请选择源');
  });

  structure.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-action]');
    if (!button) return;
    var headingId = Number(button.dataset.headingId);
    if (button.dataset.action === 'source-only') {
      var heading = state.headings[headingId];
      setExactSourceChoice(state, headingId, { start: heading.start, end: heading.markerEnd });
      updateMappingImpact();
      render();
      setStatus(state.mappingSource === null ? '已取消单标题 Source' : '已仅选择“' + (heading.text || '空标题') + '”作为 Source');
      return;
    }
    var delta = button.dataset.action === 'subtree-up' ? -1 : 1;
    var ids = getSubtreeHeadingIds(state, headingId);
    changeSubtree(state, headingId, delta);
    setImpact('subtree', ids);
    render();
    setStatus('已将“' + (state.headings[headingId].text || '空标题') + '”及其子树' +
      (delta < 0 ? '提升' : '降低') + '一级');
  });

  document.getElementById('continue-button').addEventListener('click', function () {
    continueStateWithoutNavigation(state, input);
    clearImpact();
    render();
    setStatus('当前文本及正文样式已成为新的 Baseline；Original 保持不变');
  });

  document.getElementById('reset-button').addEventListener('click', function () {
    resetStateWithoutNavigation(state, input);
    clearImpact();
    render();
    setStatus('已恢复最初 Original，并清除全部正文样式与多轮状态');
  });

  structureToggle.addEventListener('click', function () {
    var collapsed = analysisPanel.classList.toggle('is-collapsed');
    structureToggle.setAttribute('aria-expanded', String(!collapsed));
    structureToggle.textContent = collapsed ? '展开' : '收起';
  });

  document.getElementById('copy-button').addEventListener('click', async function () {
    var payload = createClipboardPayload(state);
    if (!payload.plain) { setStatus('没有可复制的内容'); return; }
    if (!payload.hasRich) {
      try {
        await navigator.clipboard.writeText(payload.plain);
        setStatus('已复制 Markdown 结果');
      } catch (error) {
        setStatus('复制失败，请在结果框中手动复制');
      }
      return;
    }
    try {
      if (!navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem === 'undefined') {
        throw new Error('ClipboardItem 不可用');
      }
      await navigator.clipboard.write([new ClipboardItem({
        'text/plain': new Blob([payload.plain], { type: 'text/plain' }),
        'text/html': new Blob([payload.html], { type: 'text/html' })
      })]);
      setStatus('已复制富文本结果（同时包含 text/plain 与 text/html）');
    } catch (error) {
      try {
        writeRichSelectionFallback(payload.html);
        setStatus('已通过兼容模式复制富文本结果');
      } catch (fallbackError) {
        setStatus('富文本复制失败，请在结果框中手动复制 Markdown 结果');
      }
    }
  });

  document.getElementById('clear-button').addEventListener('click', function () {
    input.value = '';
    state = createState('');
    clearImpact();
    render();
    setStatus('');
  });

  document.getElementById('remove-breaks-button').addEventListener('click', function () {
    var text = removeThematicBreaks(state.baseline);
    applyTextResult(state, text);
    clearImpact();
    render();
    setStatus(text === state.baseline ? '没有发现可删除的分隔线' : '已在 Result 中删除分隔线；确认后写入 Baseline');
  });

  document.getElementById('compress-guide-lines-button').addEventListener('click', function () {
    var text = compressGuideLines(state.baseline);
    applyTextResult(state, text);
    clearImpact();
    render();
    setStatus(text === state.baseline ? '没有发现可压缩的连续引导行' : '已在 Result 中压缩引导行；确认后写入 Baseline');
  });

  document.getElementById('add-preset-button').addEventListener('click', function () {
    customPresets.push({
      id: 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      name: '新正文预设',
      fontSize: 16,
      bold: false,
      builtIn: false
    });
    savePresets();
    renderPresetControls();
  });

  presetEditor.addEventListener('change', function (event) {
    var row = event.target.closest('[data-edit-preset]');
    if (!row) return;
    var preset = customPresets.find(function (item) { return item.id === row.dataset.editPreset; });
    if (!preset) return;
    var field = event.target.dataset.field;
    if (field === 'fontSize') preset.fontSize = Math.max(8, Math.min(96, Number(event.target.value) || 16));
    else if (field === 'bold') preset.bold = event.target.checked;
    else if (field === 'name') preset.name = event.target.value.trim() || '未命名预设';
    if (state.mappingPreset && state.mappingPreset.id === preset.id) state.mappingPreset = Object.assign({}, preset);
    savePresets();
    render();
  });

  presetEditor.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-delete-preset]');
    if (!button) return;
    customPresets = customPresets.filter(function (preset) { return preset.id !== button.dataset.deletePreset; });
    if (state.mappingPreset && state.mappingPreset.id === button.dataset.deletePreset) state.mappingPreset = null;
    savePresets();
    updateMappingImpact();
    render();
  });

  window.addEventListener('resize', autoSizeEditors);
  render();
}

'use strict';

var DEFAULT_PREVIEW_MODE = 'rich';

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
    mappingHeadingIds: [],
    mappingBranchRootId: null,
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
  model.mappingHeadingIds = [];
  model.mappingBranchRootId = null;
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

function hasSourceSelection(model) {
  if (model.mappingSourceMode === 'exact') return model.mappingHeadingIds.length > 0;
  if (model.mappingSourceMode === 'branch') return model.mappingBranchRootId !== null;
  return model.mappingSource !== null;
}

function mappingIsActive(model) {
  return hasSourceSelection(model) &&
    (model.mappingTarget !== null || model.mappingPreset !== null);
}

function adjustedLevelBeforeMapping(model, heading) {
  return clampLevel(heading.level + model.offsets[heading.id]);
}

function headingMatchesSource(model, heading) {
  if (!hasSourceSelection(model)) return false;
  if (model.mappingSourceMode === 'exact') return model.mappingHeadingIds.indexOf(heading.id) !== -1;
  if (model.mappingSourceMode === 'branch') {
    return getSubtreeHeadingIds(model, model.mappingBranchRootId).indexOf(heading.id) !== -1;
  }
  if (!model.mappingRange || !headingInRange(heading, model.mappingRange)) return false;
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
  if (!hasSourceSelection(model)) return [];
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
    var relativeRootLevel = model.mappingSource;
    if (model.mappingSourceMode === 'branch') {
      relativeRootLevel = adjustedLevelBeforeMapping(model, model.headings[model.mappingBranchRootId]);
    }
    return clampLevel(model.mappingTarget +
      (model.mappingSourceMode === 'and-below' || model.mappingSourceMode === 'branch'
        ? level - relativeRootLevel : 0));
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
  model.mappingHeadingIds = [];
  model.mappingBranchRootId = null;
  model.mappingTarget = target;
  model.mappingPreset = null;
  model.mappingRange = range;
}

function applyPresetMapping(model, source, preset, range, sourceMode) {
  model.mappingSource = source;
  model.mappingSourceMode = sourceMode || 'single';
  model.mappingHeadingId = null;
  model.mappingHeadingIds = [];
  model.mappingBranchRootId = null;
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
  model.mappingHeadingIds = [];
  model.mappingBranchRootId = null;
  model.mappingRange = range;
}

function setExactSourceChoice(model, headingId, range) {
  var heading = model.headings[headingId];
  if (!heading) return;
  var ids = mappingAffectedHeadingIds(model);
  var existingIndex = ids.indexOf(headingId);
  if (existingIndex === -1) ids.push(headingId);
  else ids.splice(existingIndex, 1);
  model.mappingSource = null;
  model.mappingSourceMode = 'exact';
  model.mappingHeadingIds = ids;
  model.mappingHeadingId = ids.length === 1 ? ids[0] : null;
  model.mappingBranchRootId = null;
  model.mappingRange = range;
}

function getDescendantHeadingIds(model, headingId) {
  return getSubtreeHeadingIds(model, headingId).slice(1);
}

function setDescendantsSourceChoice(model, headingId, range) {
  if (!model.headings[headingId]) return;
  var ids = getDescendantHeadingIds(model, headingId);
  model.mappingSource = null;
  model.mappingSourceMode = 'exact';
  model.mappingHeadingIds = ids;
  model.mappingHeadingId = ids.length === 1 ? ids[0] : null;
  model.mappingBranchRootId = null;
  model.mappingRange = range;
}

function setBranchSourceChoice(model, headingId, range) {
  var heading = model.headings[headingId];
  if (!heading) return;
  var isActive = model.mappingSourceMode === 'branch' && model.mappingBranchRootId === headingId;
  model.mappingSource = isActive ? null : adjustedLevelBeforeMapping(model, heading);
  model.mappingSourceMode = 'branch';
  model.mappingHeadingId = null;
  model.mappingHeadingIds = [];
  model.mappingBranchRootId = isActive ? null : headingId;
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
  model.mappingHeadingIds = [];
  model.mappingBranchRootId = null;
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
  return { lowest: sorted.length ? sorted[sorted.length - 1] : null };
}

function selectedSourceCanShift(model, delta) {
  var ids = mappingAffectedHeadingIds(model);
  if (!ids.length) return false;
  if (model.mappingSourceMode === 'branch') return true;
  return ids.every(function (id) {
    var shifted = adjustedLevelBeforeMapping(model, model.headings[id]) + delta;
    return shifted >= 1 && shifted <= 6;
  });
}

function shiftSelectedSource(model, delta) {
  if (!selectedSourceCanShift(model, delta)) return false;
  mappingAffectedHeadingIds(model).forEach(function (id) {
    model.offsets[id] += delta;
  });
  model.mappingTarget = null;
  model.mappingPreset = null;
  return true;
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

function removeInlineCodeFromLine(line) {
  function isEscaped(position) {
    var slashes = 0;
    for (var slashIndex = position - 1; slashIndex >= 0 && line[slashIndex] === '\\'; slashIndex -= 1) slashes += 1;
    return slashes % 2 === 1;
  }
  var runs = [];
  var index = 0;
  while (index < line.length) {
    if (line[index] !== '`') { index += 1; continue; }
    var end = index + 1;
    while (end < line.length && line[end] === '`') end += 1;
    if (!isEscaped(index)) runs.push({ start: index, end: end, length: end - index });
    index = end;
  }
  var output = '';
  var cursor = 0;
  for (var runIndex = 0; runIndex < runs.length; runIndex += 1) {
    var opening = runs[runIndex];
    var closingIndex = runIndex + 1;
    while (closingIndex < runs.length && runs[closingIndex].length !== opening.length) closingIndex += 1;
    if (closingIndex >= runs.length) continue;
    var closing = runs[closingIndex];
    output += line.slice(cursor, opening.start) + line.slice(opening.end, closing.start);
    cursor = closing.end;
    runIndex = closingIndex;
  }
  return output + line.slice(cursor);
}

function removeInlineCode(markdown) {
  var fence = null;
  return markdown.split('\n').map(function (line) {
    var wasInFence = Boolean(fence);
    var nextFence = fenceStep(line, fence);
    var isFenceLine = nextFence !== fence;
    var output = wasInFence || isFenceLine ? line : removeInlineCodeFromLine(line);
    fence = nextFence;
    return output;
  }).join('\n');
}

function proportionalScrollTop(source, target) {
  var sourceRange = Math.max(0, source.scrollHeight - source.clientHeight);
  var targetRange = Math.max(0, target.scrollHeight - target.clientHeight);
  if (!sourceRange || !targetRange) return 0;
  return targetRange * Math.max(0, Math.min(1, source.scrollTop / sourceRange));
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

function inlineHtmlToMarkdown(node, options) {
  options = options || {};
  if (node.nodeType === 3) return node.nodeValue.replace(/\s+/g, ' ');
  if (node.nodeType !== 1) return '';
  var tag = node.tagName.toLowerCase();
  var content = Array.prototype.map.call(node.childNodes, function (child) {
    return inlineHtmlToMarkdown(child, options);
  }).join('');
  if (tag === 'br') return '\n';
  if (tag === 'strong' || tag === 'b') return options.inHeading ? content : '**' + content + '**';
  if (tag === 'em' || tag === 'i') return '*' + content + '*';
  if (tag === 'code') {
    var tick = String.fromCharCode(96);
    var inlineFence = content.indexOf(tick) === -1 ? tick : tick + tick;
    return inlineFence + content + inlineFence;
  }
  if (tag === 'a') {
    var href = node.getAttribute('href');
    return href ? '[' + content + '](' + href + ')' : content;
  }
  return content;
}

function listHtmlToMarkdown(list, depth) {
  var ordered = list.tagName.toLowerCase() === 'ol';
  var items = Array.prototype.filter.call(list.children, function (child) {
    return child.tagName && child.tagName.toLowerCase() === 'li';
  });
  return items.map(function (item, index) {
    var inline = Array.prototype.map.call(item.childNodes, function (child) {
      if (child.nodeType === 1 && /^(ul|ol)$/i.test(child.tagName)) return '';
      if (child.nodeType === 1 && /^(p|div)$/i.test(child.tagName)) {
        return inlineHtmlToMarkdown(child, {}).trim();
      }
      return inlineHtmlToMarkdown(child, {});
    }).join('').replace(/\s*\n\s*/g, ' ').trim();
    var indent = new Array(depth + 1).join('  ');
    var marker = ordered ? (index + 1) + '. ' : '- ';
    var nested = Array.prototype.filter.call(item.children, function (child) {
      return /^(ul|ol)$/i.test(child.tagName);
    }).map(function (child) {
      return listHtmlToMarkdown(child, depth + 1);
    }).join('\n');
    return indent + marker + inline + (nested ? '\n' + nested : '');
  }).join('\n');
}

function reliableCodeLanguage(node) {
  var code = node.querySelector('code');
  var classText = ((code && code.className) || node.className || '').toString();
  var match = classText.match(/(?:^|\s)language-([A-Za-z0-9_+-]+)(?:\s|$)/);
  return match ? match[1] : '';
}

function codeBlockHtmlToMarkdown(node) {
  var content = node.textContent.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  var tick = String.fromCharCode(96);
  var runs = content.match(new RegExp(tick + '{3,}', 'g')) || [];
  var longest = runs.reduce(function (length, run) { return Math.max(length, run.length); }, 2);
  var fence = new Array(Math.max(3, longest + 1) + 1).join(tick);
  return fence + reliableCodeLanguage(node) + '\n' + content + '\n' + fence;
}

function blockChildrenToMarkdown(node) {
  return Array.prototype.map.call(node.childNodes, blockHtmlToMarkdown)
    .filter(function (value) { return value.trim(); })
    .join('\n\n');
}

function blockHtmlToMarkdown(node) {
  if (node.nodeType === 3) return node.nodeValue.trim();
  if (node.nodeType !== 1) return '';
  var tag = node.tagName.toLowerCase();
  var heading = tag.match(/^h([1-6])$/);
  if (heading) {
    return '#'.repeat(Number(heading[1])) + ' ' + inlineHtmlToMarkdown(node, { inHeading: true }).trim();
  }
  if (tag === 'p') return inlineHtmlToMarkdown(node, {}).trim();
  if (tag === 'ul' || tag === 'ol') return listHtmlToMarkdown(node, 0);
  if (tag === 'pre') return codeBlockHtmlToMarkdown(node);
  if (tag === 'blockquote') {
    var quoted = blockChildrenToMarkdown(node) || inlineHtmlToMarkdown(node, {}).trim();
    return quoted.split('\n').map(function (line) { return line ? '> ' + line : '>'; }).join('\n');
  }
  if (tag === 'hr') return '---';
  var hasBlockChild = Array.prototype.some.call(node.children, function (child) {
    return /^(h[1-6]|p|div|section|article|ul|ol|pre|blockquote|hr)$/i.test(child.tagName);
  });
  return hasBlockChild ? blockChildrenToMarkdown(node) : inlineHtmlToMarkdown(node, {}).trim();
}

function normalizeImportedMarkdown(markdown) {
  return markdown.replace(/\r\n?/g, '\n')
    .split('\n')
    .map(function (line) { return line.replace(/[ \t]+$/g, ''); })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function richHtmlToMarkdown(html) {
  var parsed = new DOMParser().parseFromString(html, 'text/html');
  return normalizeImportedMarkdown(blockChildrenToMarkdown(parsed.body));
}

function importClipboardContent(html, plain, importer) {
  if (!html) return { text: plain, usedRich: false, headingCount: 0 };
  try {
    var parsed = new DOMParser().parseFromString(html, 'text/html');
    var headingCount = parsed.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
    if (!headingCount) return { text: plain, usedRich: false, headingCount: 0 };
    var markdown = (importer || richHtmlToMarkdown)(html);
    if (!markdown && plain) return { text: plain, usedRich: false, headingCount: 0 };
    return { text: markdown, usedRich: true, headingCount: headingCount };
  } catch (error) {
    return { text: plain, usedRich: false, headingCount: 0 };
  }
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
    if (!line.trim()) {
      closeList();
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
    else html.push('<p>' + inlineMarkdown(line) + '</p>');
  });
  closeList();
  if (fence) html.push('<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
  return html.join('');
}

function renderRichHtml(model) {
  var result = renderResult(model);
  return markdownToHtml(result.text, result.metadata);
}

function createClipboardPayload(model) {
  var result = renderResult(model);
  return {
    plain: result.text,
    html: renderRichHtml(model),
    hasRich: true
  };
}

function createMarkdownClipboardPayload(model) {
  return { plain: renderMarkdown(model), html: null, hasRich: false };
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

function snapshotState(model) {
  return JSON.parse(JSON.stringify(model));
}

function restoreState(model, snapshot) {
  Object.keys(model).forEach(function (key) { delete model[key]; });
  Object.assign(model, snapshotState(snapshot));
  return model;
}

function createHistory(limit) {
  return { undo: [], redo: [], limit: Math.max(1, Number(limit) || 50) };
}

function pushHistorySnapshot(history, snapshot) {
  history.undo.push(snapshotState(snapshot));
  if (history.undo.length > history.limit) history.undo.shift();
  history.redo = [];
}

function undoHistory(history, model) {
  if (!history.undo.length) return false;
  history.redo.push(snapshotState(model));
  restoreState(model, history.undo.pop());
  return true;
}

function redoHistory(history, model) {
  if (!history.redo.length) return false;
  history.undo.push(snapshotState(model));
  restoreState(model, history.redo.pop());
  return true;
}

function bodyGhostHtml(heading, impactClass, selectionClass) {
  return '<div class="outline-cell body-ghost is-changed' +
    (selectionClass ? ' source-selected ' + selectionClass : '') +
    (impactClass ? ' ' + impactClass : '') +
    '"><div class="body-ghost-content"><span class="outline-text">' +
    escapeHtml(heading.text || '(Untitled)') + '</span></div></div>';
}

var HeadingTool = {
  DEFAULT_PREVIEW_MODE: DEFAULT_PREVIEW_MODE,
  DEFAULT_PRESETS: DEFAULT_PRESETS,
  clampLevel: clampLevel,
  cloneMetadata: cloneMetadata,
  scanMarkdown: scanMarkdown,
  createState: createState,
  establishBaseline: establishBaseline,
  headingInRange: headingInRange,
  hasSourceSelection: hasSourceSelection,
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
  getDescendantHeadingIds: getDescendantHeadingIds,
  setDescendantsSourceChoice: setDescendantsSourceChoice,
  setBranchSourceChoice: setBranchSourceChoice,
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
  selectedSourceCanShift: selectedSourceCanShift,
  shiftSelectedSource: shiftSelectedSource,
  isThematicBreak: isThematicBreak,
  removeThematicBreaks: removeThematicBreaks,
  removeInlineCode: removeInlineCode,
  proportionalScrollTop: proportionalScrollTop,
  isGuideLine: isGuideLine,
  compressGuideLines: compressGuideLines,
  mergeShortParagraphs: mergeShortParagraphs,
  remapMetadataByContent: remapMetadataByContent,
  applyTextResult: applyTextResult,
  richHtmlToMarkdown: richHtmlToMarkdown,
  importClipboardContent: importClipboardContent,
  markdownToHtml: markdownToHtml,
  renderRichHtml: renderRichHtml,
  createClipboardPayload: createClipboardPayload,
  createMarkdownClipboardPayload: createMarkdownClipboardPayload,
  combinePresets: combinePresets,
  continueStateWithoutNavigation: continueStateWithoutNavigation,
  resetStateWithoutNavigation: resetStateWithoutNavigation,
  snapshotState: snapshotState,
  restoreState: restoreState,
  createHistory: createHistory,
  pushHistorySnapshot: pushHistorySnapshot,
  undoHistory: undoHistory,
  redoHistory: redoHistory,
  bodyGhostHtml: bodyGhostHtml
};

if (typeof window !== 'undefined') window.HeadingTool = HeadingTool;
if (typeof module !== 'undefined' && module.exports) module.exports = HeadingTool;

if (typeof document !== 'undefined' && document.getElementById('markdown-input')) {
  var input = document.getElementById('markdown-input');
  var output = document.getElementById('markdown-output');
  var richPreview = document.getElementById('rich-preview');
  var richPreviewButton = document.getElementById('rich-preview-button');
  var markdownPreviewButton = document.getElementById('markdown-preview-button');
  var structure = document.getElementById('structure-view');
  var count = document.getElementById('heading-count');
  var riskMessage = document.getElementById('risk-message');
  var statusMessage = document.getElementById('status-message');
  var mappingStatus = document.getElementById('mapping-status');
  var copyMenuButton = document.getElementById('copy-menu-button');
  var copyMenu = document.getElementById('copy-menu');
  var copyMainButton = document.getElementById('copy-rich-button');
  var copyRichOption = document.getElementById('copy-rich-option');
  var copyMarkdownOption = document.getElementById('copy-markdown-button');
  var sourceLevels = document.getElementById('source-levels');
  var targetLevels = document.getElementById('target-levels');
  var presetTargets = document.getElementById('preset-targets');
  var presetEditor = document.getElementById('preset-editor');
  var lowestButton = document.getElementById('lowest-level');
  var sourceUpButton = document.getElementById('source-up-button');
  var sourceDownButton = document.getElementById('source-down-button');
  var undoButton = document.getElementById('undo-button');
  var redoButton = document.getElementById('redo-button');
  var state = createState('');
  var appHistory = createHistory(50);
  var previewMode = DEFAULT_PREVIEW_MODE;
  var copyMode = 'rich';
  var lastInputAt = 0;
  var lastImpact = null;
  var customPresets = loadCustomPresets();
  var scrollSyncLocked = false;

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

  function stateSignature(model) {
    return JSON.stringify(model);
  }

  function resultSignature(model) {
    return JSON.stringify(renderResult(model));
  }

  function performStateMutation(action, resultOnly) {
    var before = snapshotState(state);
    var beforeSignature = resultOnly ? resultSignature(state) : stateSignature(state);
    action();
    var afterSignature = resultOnly ? resultSignature(state) : stateSignature(state);
    if (beforeSignature === afterSignature) return false;
    pushHistorySnapshot(appHistory, before);
    lastInputAt = 0;
    return true;
  }

  function updateHistoryControls() {
    undoButton.disabled = appHistory.undo.length === 0;
    redoButton.disabled = appHistory.redo.length === 0;
  }

  function restoreHistoryDirection(direction) {
    var changed = direction === 'undo' ? undoHistory(appHistory, state) : redoHistory(appHistory, state);
    if (!changed) return;
    input.value = state.baseline;
    lastInputAt = 0;
    clearImpact();
    render();
    setStatus(direction === 'undo' ? 'Undid the previous action' : 'Redid the next action');
  }

  function setPreviewMode(mode) {
    previewMode = mode === 'markdown' ? 'markdown' : 'rich';
    var rich = previewMode === 'rich';
    richPreview.hidden = !rich;
    output.hidden = rich;
    richPreviewButton.classList.toggle('active', rich);
    markdownPreviewButton.classList.toggle('active', !rich);
    richPreviewButton.setAttribute('aria-pressed', String(rich));
    markdownPreviewButton.setAttribute('aria-pressed', String(!rich));
    autoSizeEditors();
    syncScroll(input, rich ? richPreview : output);
  }

  function activePreview() {
    return previewMode === 'rich' ? richPreview : output;
  }

  function syncScroll(source, target) {
    if (scrollSyncLocked || !source || !target) return;
    scrollSyncLocked = true;
    target.scrollTop = proportionalScrollTop(source, target);
    window.requestAnimationFrame(function () { scrollSyncLocked = false; });
  }

  function autoSizeEditors() {
    var maximum = Math.max(260, Math.min(window.innerHeight * 0.65, 720));
    var editors = [input, output, richPreview];
    editors.forEach(function (editor) { editor.style.height = 'auto'; });
    var desired = Math.min(maximum, Math.max(170, input.scrollHeight, output.scrollHeight, richPreview.scrollHeight));
    editors.forEach(function (editor) {
      editor.style.height = desired + 'px';
      editor.style.overflowY = editor.scrollHeight > desired ? 'auto' : 'hidden';
    });
  }

  function snapHorizontalConnectors() {
    var ratio = window.devicePixelRatio || 1;
    var physicalThickness = Math.max(1, Math.round(2 * ratio));
    var cssThickness = physicalThickness / ratio;
    Array.prototype.forEach.call(structure.querySelectorAll('.horizontal-connector'), function (connector) {
      var row = connector.parentElement.getBoundingClientRect();
      var topDevicePixel = Math.round((row.top + row.height / 2) * ratio - physicalThickness / 2);
      connector.style.top = (topDevicePixel / ratio - row.top) + 'px';
      connector.style.height = cssThickness + 'px';
    });
  }

  function renderPath(path, continuations) {
    return '<span class="dot-path" style="--path-count:' + path.length + '" aria-label="' +
      path.map(function (present, index) { return 'H' + (index + 1) + (present ? ' present' : ' missing'); }).join(', ') +
      '">' + path.map(function (present, index) {
        return '<span class="path-dot ' + (present ? 'present' : 'missing') +
          (continuations[index] ? ' path-continues' : ' path-ends') + '">' + (present ? '●' : '○') + '</span>';
      }).join('') + '</span>';
  }

  function outlineCell(text, level, path, continuations, changed, headingId, actionsEnabled, impactClass, continues, sourceActionsEnabled, selectionClass) {
    var actions = actionsEnabled
      ? '<span class="branch-actions"><button type="button" data-action="subtree-up" data-heading-id="' + headingId +
        '" title="Promote this heading and branch" aria-label="Promote this heading and branch">↑</button>' +
        '<button type="button" data-action="subtree-down" data-heading-id="' + headingId +
        '" title="Demote this heading and branch" aria-label="Demote this heading and branch">↓</button></span>' : '';
    var exactSelected = mappingAffectedHeadingIds(state).indexOf(headingId) !== -1;
    var descendantIds = getDescendantHeadingIds(state, headingId);
    var descendantsSelected = descendantIds.length > 0 && descendantIds.every(function (id) {
      return state.mappingSourceMode === 'exact' && state.mappingHeadingIds.indexOf(id) !== -1;
    });
    var sourceActions = sourceActionsEnabled
      ? '<span class="source-row-actions"><button type="button" class="exact-source-button' +
        (exactSelected ? ' active' : '') + '" data-action="source-select" data-heading-id="' + headingId +
        '" aria-pressed="' + String(exactSelected) + '" title="' + (exactSelected ? 'Deselect this heading' : 'Select this heading') +
        '" aria-label="' + (exactSelected ? 'Deselect this heading' : 'Select this heading') + '">✓</button>' +
        '<button type="button" class="branch-source-button' + (descendantsSelected ? ' active' : '') +
        '" data-action="select-descendants" data-heading-id="' + headingId + '" aria-pressed="' +
        String(descendantsSelected) + '" title="Select descendants" aria-label="Select descendants"><svg class="row-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h7a3 3 0 0 1 3 3v2"/><path d="m12 16 3 3 5-6"/></svg></button></span>' : '';
    return '<div class="outline-cell level-' + level + (changed ? ' is-changed' : '') +
      (selectionClass ? ' source-selected ' + selectionClass : '') +
      (impactClass ? ' ' + impactClass : '') + '"><div class="outline-node" style="--path-count:' +
      path.length + '"><span class="horizontal-connector" aria-hidden="true"></span>' +
      renderPath(path, continuations) +
      '<span class="current-axis' + (continues ? ' continues' : '') + '" aria-hidden="true">' +
      '<span class="current-node"></span></span>' +
      '<span class="outline-text" title="' + text + '">' + text + '</span>' +
      '<span class="level-name">H' + level + '</span>' + sourceActions + actions + '</div></div>';
  }

  function displayPresetName(preset) {
    if (!preset || !preset.builtIn) return preset ? preset.name : '';
    return preset.fontSize + 'px ' + (preset.bold ? 'Bold' : 'Regular');
  }

  function renderPresetControls() {
    var presets = allPresets().slice().sort(function (a, b) {
      if (!a.builtIn || !b.builtIn) return Number(b.builtIn) - Number(a.builtIn);
      return a.fontSize - b.fontSize || Number(a.bold) - Number(b.bold);
    });
    presetTargets.innerHTML = presets.map(function (preset) {
      var active = state.mappingPreset && state.mappingPreset.id === preset.id;
      return '<button type="button" data-preset-id="' + escapeHtml(preset.id) + '" class="' +
        (active ? 'active' : '') + '" aria-pressed="' + String(Boolean(active)) + '">' +
        escapeHtml(displayPresetName(preset)) + '</button>';
    }).join('');
    presetEditor.innerHTML = DEFAULT_PRESETS.slice().sort(function (a, b) {
      return a.fontSize - b.fontSize || Number(a.bold) - Number(b.bold);
    }).map(function (preset) {
      return '<div class="preset-edit-row built-in"><span class="preset-row-name">' +
        escapeHtml(displayPresetName(preset)) + '</span><span class="preset-row-size">' +
        preset.fontSize + 'px</span><span class="preset-row-weight">' +
        (preset.bold ? 'Bold' : 'Regular') + '</span><span aria-hidden="true"></span></div>';
    }).concat(customPresets.map(function (preset) {
      return '<div class="preset-edit-row" data-edit-preset="' + escapeHtml(preset.id) + '">' +
        '<input data-field="name" value="' + escapeHtml(preset.name) + '" aria-label="Preset name">' +
        '<input data-field="fontSize" type="number" min="8" max="96" value="' + preset.fontSize + '" aria-label="Font size">' +
        '<label><input data-field="bold" type="checkbox"' + (preset.bold ? ' checked' : '') + '> Bold</label>' +
        '<button type="button" data-delete-preset="' + escapeHtml(preset.id) + '">Delete</button></div>';
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
    lowestButton.textContent = dynamic.lowest === null ? 'Minimum Level' : 'Minimum Level H' + dynamic.lowest;
    lowestButton.classList.toggle('active', !lowestButton.disabled &&
      Number(lowestButton.dataset.level) === state.mappingSource && state.mappingSourceMode === 'single');
    sourceUpButton.disabled = !selectedSourceCanShift(state, -1);
    sourceDownButton.disabled = !selectedSourceCanShift(state, 1);
    updateHistoryControls();
    renderPresetControls();
    var sourceLabel = '';
    if (state.mappingSourceMode === 'exact' && state.mappingHeadingIds.length) {
      sourceLabel = 'Selected ' + state.mappingHeadingIds.length +
        (state.mappingHeadingIds.length === 1 ? ' heading' : ' headings');
    } else if (state.mappingSourceMode === 'branch' && state.mappingBranchRootId !== null) {
      sourceLabel = 'This Branch: ' + (state.headings[state.mappingBranchRootId].text || 'Untitled');
    } else if (state.mappingSource !== null) {
      sourceLabel = 'H' + state.mappingSource + (state.mappingSourceMode === 'and-below' ? '+' : '');
    }
    if (mappingIsActive(state)) {
      mappingStatus.textContent = 'Live conversion: ' + sourceLabel + ' → ' +
        (state.mappingPreset ? state.mappingPreset.name + ' body' : 'H' + state.mappingTarget);
    } else if (sourceLabel) {
      mappingStatus.textContent = sourceLabel + ' · choose a target';
    } else {
      mappingStatus.textContent = 'Choose a source and target to transform headings.';
    }
  }

  function render() {
    var result = renderResult(state);
    output.value = result.text;
    richPreview.innerHTML = renderRichHtml(state);
    count.textContent = state.headings.length + (state.headings.length === 1 ? ' heading' : ' headings');
    renderMappingControls();
    if (!state.headings.length) {
      structure.innerHTML = '<p class="empty-state">No valid ATX headings found.</p>';
    } else {
      var remaining = state.headings.filter(function (heading) { return !headingConvertsToBody(state, heading); });
      var beforePaths = ancestorPaths(state.headings.map(function (heading) { return heading.level; }));
      var beforeContinuations = ancestorContinuations(beforePaths);
      var remainingPaths = ancestorPaths(remaining.map(function (heading) { return targetLevel(state, heading); }));
      var remainingContinuations = ancestorContinuations(remainingPaths);
      var selectedHeadingIds = mappingAffectedHeadingIds(state);
      var afterPathById = {};
      remaining.forEach(function (heading, index) {
        afterPathById[heading.id] = { path: remainingPaths[index], continuation: remainingContinuations[index], index: index };
      });
      structure.innerHTML = '<ol class="outline-rows">' + state.headings.map(function (heading, index) {
          var affected = lastImpact && lastImpact.ids.indexOf(heading.id) !== -1;
          var beforeImpact = affected ? 'impact impact-' + lastImpact.type + ' impact-before' : '';
          var showAfter = affected && (lastImpact.type !== 'mapping' || mappingIsActive(state));
          var afterImpact = showAfter ? 'impact impact-' + lastImpact.type + ' impact-after' : '';
          var selected = selectedHeadingIds.indexOf(heading.id) !== -1;
          var previousSelected = index > 0 && heading.level !== 1 &&
            selectedHeadingIds.indexOf(state.headings[index - 1].id) !== -1;
          var nextSelected = index < state.headings.length - 1 && state.headings[index + 1].level !== 1 &&
            selectedHeadingIds.indexOf(state.headings[index + 1].id) !== -1;
          var selectionClass = !selected ? '' : !previousSelected && !nextSelected ? 'selected-single' :
            !previousSelected ? 'selected-start' : !nextSelected ? 'selected-end' : 'selected-middle';
          var beforeContinues = Boolean(beforePaths[index + 1] && beforePaths[index + 1][heading.level - 1]);
          var before = outlineCell(escapeHtml(heading.text || '(Untitled)'), heading.level, beforePaths[index],
            beforeContinuations[index], false, heading.id, false, beforeImpact, beforeContinues, false, selectionClass);
          if (headingConvertsToBody(state, heading)) {
            return '<li class="outline-row' + (heading.level === 1 ? ' h1-branch-start' : '') +
              '" data-heading-id="' + heading.id + '">' + before + bodyGhostHtml(heading, afterImpact, selectionClass) + '</li>';
          }
          var info = afterPathById[heading.id];
          var target = targetLevel(state, heading);
          var nextRemaining = remaining[info.index + 1];
          var afterContinues = Boolean(nextRemaining && info.path && afterPathById[nextRemaining.id].path[target - 1]);
          return '<li class="outline-row' + (heading.level === 1 ? ' h1-branch-start' : '') +
            '" data-heading-id="' + heading.id + '">' + before + outlineCell(escapeHtml(heading.text || '(Untitled)'), target, info.path, info.continuation,
              target !== heading.level, heading.id, true, afterImpact, afterContinues, true, selectionClass) + '</li>';
        }).join('') + '</ol>';
    }
    snapHorizontalConnectors();
    var inversionRisks = findRisks(state);
    var bodyRisks = findBodyConversionRisks(state);
    var messages = [];
    if (inversionRisks.length) messages.push('Found ' + inversionRisks.length + ' possible hierarchy inversions.');
    if (bodyRisks.length) messages.push('After body conversion, ' + bodyRisks.length + ' headings still have descendants; their parent structure will be removed.');
    riskMessage.hidden = messages.length === 0;
    riskMessage.textContent = messages.join(' ') + (messages.length ? ' You can still continue.' : '');
    autoSizeEditors();
  }

  function updateMappingImpact() {
    if (!hasSourceSelection(state)) clearImpact();
    else setImpact('mapping', mappingAffectedHeadingIds(state));
  }

  function captureContinueLayout() {
    var survivingRows = Array.prototype.filter.call(structure.querySelectorAll('.outline-row'), function (row) {
      var heading = state.headings[Number(row.dataset.headingId)];
      return heading && !headingConvertsToBody(state, heading);
    });
    return {
      rows: survivingRows.map(function (row) { return row.getBoundingClientRect().top; }),
      followers: [
        document.querySelector('.utility-panel'),
        document.querySelector('.editor'),
        document.querySelector('.preset-settings')
      ].map(function (element) {
        return { element: element, top: element.getBoundingClientRect().top };
      })
    };
  }

  function animateContinueReposition(beforeLayout) {
    if (!beforeLayout || !Element.prototype.animate ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var animationOptions = { duration: 190, easing: 'cubic-bezier(.2, .7, .2, 1)' };
    var rows = structure.querySelectorAll('.outline-row');
    Array.prototype.forEach.call(rows, function (row, index) {
      var previousTop = beforeLayout.rows[index];
      if (previousTop === undefined) return;
      var delta = previousTop - row.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) return;
      row.animate([{ transform: 'translateY(' + delta + 'px)' }, { transform: 'translateY(0)' }], animationOptions);
    });
    beforeLayout.followers.forEach(function (item) {
      var delta = item.top - item.element.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) return;
      item.element.animate([{ transform: 'translateY(' + delta + 'px)' }, { transform: 'translateY(0)' }], animationOptions);
    });
  }

  function chooseSource(level, mode) {
    var range = currentRange();
    performStateMutation(function () {
      setSourceChoice(state, level, mode || 'single', range);
    }, true);
    updateMappingImpact();
    render();
    setStatus(mappingIsActive(state) ? 'Heading conversion applied' : 'Source updated; choose a target');
  }

  function writeRichSelectionFallback(html, plain) {
    var holder = document.createElement('div');
    holder.contentEditable = 'true';
    holder.setAttribute('aria-hidden', 'true');
    holder.style.position = 'fixed';
    holder.style.left = '-9999px';
    holder.innerHTML = html;
    document.body.appendChild(holder);
    var handleCopy = function (event) {
      event.preventDefault();
      event.clipboardData.setData('text/html', html);
      event.clipboardData.setData('text/plain', plain);
    };
    document.addEventListener('copy', handleCopy, { once: true });
    var selection = window.getSelection();
    var range = document.createRange();
    range.selectNodeContents(holder);
    selection.removeAllRanges();
    selection.addRange(range);
    var copied = document.execCommand('copy');
    selection.removeAllRanges();
    holder.remove();
    if (!copied) {
      document.removeEventListener('copy', handleCopy);
      throw new Error('富文本回退复制失败');
    }
  }

  function writePlainTextFallback(text) {
    var holder = document.createElement('textarea');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.position = 'fixed';
    holder.style.left = '-9999px';
    holder.value = text;
    document.body.appendChild(holder);
    var handleCopy = function (event) {
      event.preventDefault();
      event.clipboardData.setData('text/plain', text);
    };
    document.addEventListener('copy', handleCopy, { once: true });
    holder.select();
    var copied = document.execCommand('copy');
    holder.remove();
    if (!copied) {
      document.removeEventListener('copy', handleCopy);
      throw new Error('纯文本回退复制失败');
    }
  }

  input.addEventListener('paste', function (event) {
    if (!event.clipboardData) return;
    var imported = importClipboardContent(
      event.clipboardData.getData('text/html'),
      event.clipboardData.getData('text/plain')
    );
    if (!imported.usedRich) return;
    event.preventDefault();
    var start = input.selectionStart;
    var end = input.selectionEnd;
    var before = snapshotState(state);
    var nextText = input.value.slice(0, start) + imported.text + input.value.slice(end);
    input.value = nextText;
    state = createState(nextText);
    pushHistorySnapshot(appHistory, before);
    lastInputAt = 0;
    clearImpact();
    render();
    setStatus('Rich text structure recognized · ' + imported.headingCount + ' headings');
  });
  input.addEventListener('input', function (event) {
    var now = Date.now();
    var isSeparateInput = event.inputType === 'insertFromPaste' || event.inputType === 'insertFromDrop' ||
      now - lastInputAt > 800;
    if (isSeparateInput) pushHistorySnapshot(appHistory, state);
    lastInputAt = now;
    state = createState(input.value);
    clearImpact();
    render();
    setStatus(state.headings.length ? 'Created a new Original and Baseline; previous body styles were cleared' : '');
  });

  sourceLevels.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-level]');
    if (!button) return;
    chooseSource(Number(button.dataset.level), button.dataset.sourceMode || 'single');
  });

  lowestButton.addEventListener('click', function () {
    if (lowestButton.disabled || !lowestButton.dataset.level) return;
    chooseSource(Number(lowestButton.dataset.level), 'single');
  });

  targetLevels.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-level]');
    if (!button) return;
    var range = currentRange();
    performStateMutation(function () {
      setMappingChoice(state, 'target', Number(button.dataset.level), range);
    }, true);
    updateMappingImpact();
    render();
    setStatus(mappingIsActive(state) ? 'Heading level conversion applied' : 'Target updated; choose a source');
  });

  presetTargets.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-preset-id]');
    if (!button) return;
    var preset = allPresets().find(function (item) { return item.id === button.dataset.presetId; });
    if (!preset) return;
    performStateMutation(function () {
      setPresetChoice(state, preset, currentRange());
    }, true);
    updateMappingImpact();
    render();
    setStatus(mappingIsActive(state) ? 'Body conversion applied' : 'Body preset updated; choose a source');
  });

  structure.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-action]');
    if (!button) return;
    var headingId = Number(button.dataset.headingId);
    var heading = state.headings[headingId];
    if (button.dataset.action === 'source-select') {
      performStateMutation(function () {
        setExactSourceChoice(state, headingId, { start: 0, end: state.baseline.length });
      }, true);
      updateMappingImpact();
      render();
      setStatus(state.mappingHeadingIds.length
        ? 'Selected ' + state.mappingHeadingIds.length + (state.mappingHeadingIds.length === 1 ? ' heading' : ' headings')
        : 'Heading selection cleared');
      return;
    }
    if (button.dataset.action === 'select-descendants') {
      performStateMutation(function () {
        setDescendantsSourceChoice(state, headingId, { start: 0, end: state.baseline.length });
      }, true);
      updateMappingImpact();
      render();
      setStatus(state.mappingHeadingIds.length
        ? 'Selected ' + state.mappingHeadingIds.length + (state.mappingHeadingIds.length === 1 ? ' descendant' : ' descendants')
        : 'This heading has no descendants');
      return;
    }
    if (button.dataset.action !== 'subtree-up' && button.dataset.action !== 'subtree-down') return;
    var delta = button.dataset.action === 'subtree-up' ? -1 : 1;
    var ids = getSubtreeHeadingIds(state, headingId);
    performStateMutation(function () {
      changeSubtree(state, headingId, delta);
    }, false);
    setImpact('subtree', ids);
    render();
    setStatus('Changed “' + (state.headings[headingId].text || 'Untitled') + '” and its branch ' +
      (delta < 0 ? 'promoted ' : 'demoted ') + 'one level');
  });

  document.getElementById('continue-button').addEventListener('click', function () {
    var beforeLayout = captureContinueLayout();
    performStateMutation(function () {
      continueStateWithoutNavigation(state, input);
    }, false);
    clearImpact();
    render();
    animateContinueReposition(beforeLayout);
    setStatus('The current result is now the Baseline; Original is unchanged');
  });

  document.getElementById('reset-button').addEventListener('click', function () {
    performStateMutation(function () {
      resetStateWithoutNavigation(state, input);
    }, false);
    clearImpact();
    render();
    setStatus('Restored Original and cleared all body styles and transformation state');
  });


  sourceUpButton.addEventListener('click', function () {
    if (sourceUpButton.disabled) return;
    var ids = mappingAffectedHeadingIds(state);
    performStateMutation(function () { shiftSelectedSource(state, -1); }, false);
    setImpact('source-shift', ids);
    render();
    setStatus('Promoted the current source one level');
  });

  sourceDownButton.addEventListener('click', function () {
    if (sourceDownButton.disabled) return;
    var ids = mappingAffectedHeadingIds(state);
    performStateMutation(function () { shiftSelectedSource(state, 1); }, false);
    setImpact('source-shift', ids);
    render();
    setStatus('Demoted the current source one level');
  });

  undoButton.addEventListener('click', function () { restoreHistoryDirection('undo'); });
  redoButton.addEventListener('click', function () { restoreHistoryDirection('redo'); });
  richPreviewButton.addEventListener('click', function () { setPreviewMode('rich'); });
  markdownPreviewButton.addEventListener('click', function () { setPreviewMode('markdown'); });
  input.addEventListener('scroll', function () { syncScroll(input, activePreview()); });
  richPreview.addEventListener('scroll', function () { syncScroll(richPreview, input); });
  output.addEventListener('scroll', function () { syncScroll(output, input); });

  function closeCopyMenu() {
    copyMenu.hidden = true;
    copyMenuButton.setAttribute('aria-expanded', 'false');
  }

  function setCopyMode(mode) {
    copyMode = mode === 'markdown' ? 'markdown' : 'rich';
    var rich = copyMode === 'rich';
    copyMainButton.textContent = rich ? 'Copy Rich Text' : 'Copy Markdown';
    copyMainButton.setAttribute('aria-label', rich ? 'Copy Rich Text' : 'Copy Markdown');
    copyRichOption.classList.toggle('active', rich);
    copyMarkdownOption.classList.toggle('active', !rich);
    copyRichOption.setAttribute('aria-checked', String(rich));
    copyMarkdownOption.setAttribute('aria-checked', String(!rich));
  }

  async function copyRichContent() {
    var payload = createClipboardPayload(state);
    if (!payload.plain) { setStatus('Nothing to copy'); return; }
    try {
      if (!navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem === 'undefined') {
        throw new Error('ClipboardItem unavailable');
      }
      await navigator.clipboard.write([new ClipboardItem({
        'text/plain': new Blob([payload.plain], { type: 'text/plain' }),
        'text/html': new Blob([payload.html], { type: 'text/html' })
      })]);
      setStatus('Rich text copied');
    } catch (error) {
      try {
        writeRichSelectionFallback(payload.html, payload.plain);
        setStatus('Rich text copied in compatibility mode');
      } catch (fallbackError) {
        setStatus('Could not copy rich text; check browser permissions');
      }
    }
  }

  async function copyMarkdownContent() {
    var payload = createMarkdownClipboardPayload(state);
    if (!payload.plain) { setStatus('Nothing to copy'); return; }
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(payload.plain);
      setStatus('Markdown copied');
    } catch (error) {
      try {
        writePlainTextFallback(payload.plain);
        setStatus('Markdown copied in compatibility mode');
      } catch (fallbackError) {
        setStatus('Could not copy Markdown; copy it from the preview');
      }
    }
  }

  function copyCurrentMode() {
    return copyMode === 'markdown' ? copyMarkdownContent() : copyRichContent();
  }

  copyMenuButton.addEventListener('click', function () {
    var willOpen = copyMenu.hidden;
    copyMenu.hidden = !willOpen;
    copyMenuButton.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) copyMenu.querySelector('.active').focus();
  });

  document.addEventListener('click', function (event) {
    if (!event.target.closest('.copy-split')) closeCopyMenu();
  });
  copyMainButton.addEventListener('click', function () { copyCurrentMode(); });
  copyRichOption.addEventListener('click', function () {
    setCopyMode('rich');
    closeCopyMenu();
    copyCurrentMode();
  });
  copyMarkdownOption.addEventListener('click', function () {
    setCopyMode('markdown');
    closeCopyMenu();
    copyCurrentMode();
  });

  document.getElementById('remove-breaks-button').addEventListener('click', function () {
    var text = removeThematicBreaks(state.baseline);
    if (text !== state.baseline) performStateMutation(function () {
      applyTextResult(state, text);
    }, false);
    clearImpact();
    render();
    setStatus(text === state.baseline ? 'No dividers found' : 'Dividers removed from Result; continue to update Baseline');
  });

  document.getElementById('compress-guide-lines-button').addEventListener('click', function () {
    var text = compressGuideLines(state.baseline);
    if (text !== state.baseline) performStateMutation(function () {
      applyTextResult(state, text);
    }, false);
    clearImpact();
    render();
    setStatus(text === state.baseline ? 'No consecutive guide lines found' : 'Guide lines compressed in Result; continue to update Baseline');
  });

  document.getElementById('remove-inline-code-button').addEventListener('click', function () {
    var text = removeInlineCode(state.baseline);
    if (text !== state.baseline) performStateMutation(function () {
      applyTextResult(state, text);
    }, false);
    clearImpact();
    render();
    setStatus(text === state.baseline ? 'No inline code found' : 'Inline code delimiters removed from Result; continue to update Baseline');
  });

  document.getElementById('add-preset-button').addEventListener('click', function () {
    customPresets.push({
      id: 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      name: 'New Body Preset',
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
    else if (field === 'name') preset.name = event.target.value.trim() || 'Untitled Preset';
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

  window.addEventListener('resize', function () {
    autoSizeEditors();
    snapHorizontalConnectors();
  });
  setPreviewMode(DEFAULT_PREVIEW_MODE);
  setCopyMode('rich');
  render();
}

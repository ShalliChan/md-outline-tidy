'use strict';

const markdownInput = document.getElementById('markdown-input');
const markdownOutput = document.getElementById('markdown-output');
const promoteButton = document.getElementById('promote-button');
const demoteButton = document.getElementById('demote-button');
const copyButton = document.getElementById('copy-button');
const clearButton = document.getElementById('clear-button');
const statusMessage = document.getElementById('status-message');

function transformHeadings(markdown, direction) {
  let isInCodeFence = false;
  let fenceCharacter = '';
  let openingFenceLength = 0;

  return markdown.split('\n').map((line) => {
    if (isInCodeFence) {
      const closingFence = line.match(/^ {0,3}(`+|~+)[ \t]*$/);

      if (
        closingFence
        && closingFence[1][0] === fenceCharacter
        && closingFence[1].length >= openingFenceLength
      ) {
        isInCodeFence = false;
        fenceCharacter = '';
        openingFenceLength = 0;
      }

      return line;
    }

    const openingFence = line.match(/^ {0,3}(`{3,}|~{3,})/);

    if (openingFence) {
      isInCodeFence = true;
      fenceCharacter = openingFence[1][0];
      openingFenceLength = openingFence[1].length;
      return line;
    }

    return line.replace(/^#{1,6}(?= )/, (headingMarker) => {
      if (direction === 'up') {
        return headingMarker.length === 1
          ? headingMarker
          : headingMarker.slice(1);
      }

      if (direction === 'down') {
        return headingMarker.length === 6
          ? headingMarker
          : `${headingMarker}#`;
      }

      return headingMarker;
    });
  }).join('\n');
}

promoteButton.addEventListener('click', () => {
  if (!markdownInput.value) {
    markdownOutput.value = '';
    statusMessage.textContent = '请输入 Markdown 内容';
    return;
  }

  markdownOutput.value = transformHeadings(markdownInput.value, 'up');
  statusMessage.textContent = '升级完成';
});

demoteButton.addEventListener('click', () => {
  if (!markdownInput.value) {
    markdownOutput.value = '';
    statusMessage.textContent = '请输入 Markdown 内容';
    return;
  }

  markdownOutput.value = transformHeadings(markdownInput.value, 'down');
  statusMessage.textContent = '降级完成';
});

copyButton.addEventListener('click', async () => {
  if (!markdownOutput.value) {
    statusMessage.textContent = '没有可复制的内容';
    return;
  }

  try {
    await navigator.clipboard.writeText(markdownOutput.value);
    statusMessage.textContent = '已复制';
  } catch (error) {
    statusMessage.textContent = '复制失败，请手动选择并复制输出内容';
  }
});

clearButton.addEventListener('click', () => {
  markdownInput.value = '';
  markdownOutput.value = '';
  statusMessage.textContent = '';
});

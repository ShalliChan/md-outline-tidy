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
  markdownOutput.value = transformHeadings(markdownInput.value, 'up');
});

demoteButton.addEventListener('click', () => {
  markdownOutput.value = transformHeadings(markdownInput.value, 'down');
});
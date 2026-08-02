'use strict';

const markdownInput = document.getElementById('markdown-input');
const markdownOutput = document.getElementById('markdown-output');
const promoteButton = document.getElementById('promote-button');
const demoteButton = document.getElementById('demote-button');
const copyButton = document.getElementById('copy-button');
const clearButton = document.getElementById('clear-button');
const statusMessage = document.getElementById('status-message');

function transformHeadings(markdown, direction) {
  return markdown.replace(/^#{1,6}(?= )/gm, (headingMarker) => {
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
}

promoteButton.addEventListener('click', () => {
  markdownOutput.value = transformHeadings(markdownInput.value, 'up');
});

demoteButton.addEventListener('click', () => {
  markdownOutput.value = transformHeadings(markdownInput.value, 'down');
});
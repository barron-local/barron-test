const vscode = require('vscode');
const steps = require('./stepsData');

const normalizeCode = s => s.replace(/['";\s]/g, '');

class BarronInlineCompletionProvider {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.enabled = true;
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  /**
   * Find matching step for the current active document
   */
  getStepForDocument(document) {
    const docPath = document.uri.fsPath.replace(/\\/g, '/').toLowerCase();
    for (const step of steps) {
      const target = step.targetFile.replace(/\\/g, '/').toLowerCase();
      if (docPath.endsWith('/' + target) || docPath.endsWith(target)) {
        return step;
      }
    }
    return null;
  }

  /**
   * Find the exact line index in targetLines that matches or corresponds to user's position
   */
  findTargetPointer(docLines, currentLine, currentCol, targetLines) {
    let targetIdx = 0;
    for (let d = 0; d < currentLine; d++) {
      const docLineTrim = (docLines[d] || '').trim();
      if (!docLineTrim) {
        if (targetIdx < targetLines.length && targetLines[targetIdx].trim() === '') {
          targetIdx++;
        }
        continue;
      }
      while (targetIdx < targetLines.length) {
        const targetTrim = targetLines[targetIdx].trim();
        if (targetTrim === docLineTrim || normalizeCode(targetTrim) === normalizeCode(docLineTrim)) {
          targetIdx++;
          break;
        }
        targetIdx++;
      }
    }

    const currentPrefix = (docLines[currentLine] || '').substring(0, currentCol);
    const currentPrefixTrim = currentPrefix.trim();

    // Look ahead up to 10 lines to match user's prefix
    if (currentPrefixTrim.length > 0) {
      for (let look = 0; look < 10 && (targetIdx + look) < targetLines.length; look++) {
        const candLine = targetLines[targetIdx + look];
        const candTrim = candLine.trim();
        if (candLine.startsWith(currentPrefix) || candTrim.startsWith(currentPrefixTrim)) {
          targetIdx += look;
          break;
        }
      }
    } else {
      while (targetIdx < targetLines.length && targetLines[targetIdx].trim() === '') {
        targetIdx++;
      }
    }

    return targetIdx;
  }

  /**
   * Get the suggestion chunk and replacement range
   */
  getSuggestionChunk(targetLines, targetIdx, currentLineText, position, linesCount = 1) {
    if (targetIdx >= targetLines.length) return null;
    const currentTargetLine = targetLines[targetIdx];
    const textBeforeCursor = currentLineText.substring(0, position.character);
    const textAfterCursor = currentLineText.substring(position.character);

    let restOfLine = null;

    // 1. Exact prefix match
    if (currentTargetLine.startsWith(textBeforeCursor)) {
      restOfLine = currentTargetLine.substring(textBeforeCursor.length);
    } else {
      // 2. Trimmed prefix match with matching indentation
      const trimmedTarget = currentTargetLine.trimStart();
      const trimmedBefore = textBeforeCursor.trimStart();

      if (trimmedTarget.startsWith(trimmedBefore)) {
        const indentTarget = currentTargetLine.substring(0, currentTargetLine.length - trimmedTarget.length);
        const indentBefore = textBeforeCursor.substring(0, textBeforeCursor.length - trimmedBefore.length);
        if (indentTarget === indentBefore) {
          restOfLine = trimmedTarget.substring(trimmedBefore.length);
        }
      }
    }

    // If prefix doesn't match, only suggest if line before cursor is pure whitespace/empty
    if (restOfLine === null) {
      if (textBeforeCursor.trim() === '') {
        restOfLine = currentTargetLine.substring(textBeforeCursor.length);
      } else {
        return null;
      }
    }

    // 3. Handle auto-closed characters (quotes, brackets) that VS Code inserted after cursor
    let replaceCount = 0;
    if (textAfterCursor.length > 0) {
      while (
        replaceCount < textAfterCursor.length &&
        replaceCount < restOfLine.length &&
        textAfterCursor[replaceCount] === restOfLine[replaceCount]
      ) {
        replaceCount++;
      }
    }

    let insertText = restOfLine;

    // Add subsequent lines if linesCount > 1
    const additionalLines = [];
    let nextIdx = targetIdx + 1;
    let codeLinesCollected = insertText.trim().length > 0 ? 1 : 0;

    while (nextIdx < targetLines.length && codeLinesCollected < linesCount) {
      const line = targetLines[nextIdx];
      additionalLines.push(line);
      if (line.trim().length > 0) {
        codeLinesCollected++;
      }
      nextIdx++;
    }

    if (additionalLines.length > 0) {
      insertText += '\n' + additionalLines.join('\n');
    }

    if (!insertText) return null;

    // Replacement range starts at cursor and extends over auto-closed characters
    const range = new vscode.Range(
      position,
      new vscode.Position(position.line, position.character + replaceCount)
    );

    return { insertText, range };
  }

  provideInlineCompletionItems(document, position, context, token) {
    if (!this.enabled) {
      return null;
    }

    const step = this.getStepForDocument(document);
    if (!step) {
      return null;
    }

    const targetContent = step.content;
    const targetLines = targetContent.split(/\r?\n/);
    const docText = document.getText();
    const docLines = docText.split(/\r?\n/);

    // If already 100% completed
    if (docText.trim() === targetContent.trim() || normalizeCode(docText) === normalizeCode(targetContent)) {
      this.stateManager.markStepCompleted(step.id);
      return null;
    }

    const currentLineIndex = position.line;
    const currentLineText = docLines[currentLineIndex] || '';

    const config = vscode.workspace.getConfiguration('barron');
    const linesCount = config.get('linesPerSuggestion', 1);

    const targetIdx = this.findTargetPointer(docLines, currentLineIndex, position.character, targetLines);
    if (targetIdx >= targetLines.length) {
      this.stateManager.markStepCompleted(step.id);
      return null;
    }

    const result = this.getSuggestionChunk(targetLines, targetIdx, currentLineText, position, linesCount);
    if (!result || !result.insertText) {
      return null;
    }

    const item = new vscode.InlineCompletionItem(result.insertText, result.range);
    return [item];
  }
}

module.exports = BarronInlineCompletionProvider;

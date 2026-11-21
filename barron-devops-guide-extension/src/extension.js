const vscode = require('vscode');
const StateManager = require('./stateManager');
const BarronStatusBar = require('./statusBar');
const BarronInlineCompletionProvider = require('./inlineProvider');
const BarronSidebarViewProvider = require('./sidebarView');
const registerCommands = require('./commands');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // Ensure Inline Suggestion (Ghost Text) is enabled in VS Code settings
  try {
    const editorConfig = vscode.workspace.getConfiguration('editor');
    if (!editorConfig.get('inlineSuggest.enabled')) {
      editorConfig.update('inlineSuggest.enabled', true, vscode.ConfigurationTarget.Global);
    }
    // ซ่อนกล่อง Toolbar เล็ก ๆ (Accept Tab, Accept Word) ไม่ให้ลอยขึ้นมารบกวนสายตา
    editorConfig.update('inlineSuggest.showToolbar', 'never', vscode.ConfigurationTarget.Global);
  } catch (e) {
    console.warn('Could not auto-enable inlineSuggest.enabled:', e);
  }

  // 1. Initialize State Manager
  const stateManager = new StateManager(context);

  // 2. Initialize Status Bar (Bottom Left)
  const statusBar = new BarronStatusBar(stateManager);
  context.subscriptions.push(statusBar);

  // 3. Register Inline Completion Provider (Ghost Text / Tab suggestions)
  const inlineProvider = new BarronInlineCompletionProvider(stateManager);
  const inlineDisposable = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: '**/*' },
    inlineProvider
  );
  context.subscriptions.push(inlineDisposable);

  // 4. Register Completion Item Provider (IntelliSense Ctrl+Space suggestions)
  const completionDisposable = vscode.languages.registerCompletionItemProvider(
    { pattern: '**/*' },
    {
      provideCompletionItems(document, position, token, context) {
        const step = inlineProvider.getStepForDocument(document);
        if (!step) return undefined;

        const targetLines = step.content.split(/\r?\n/);
        const currentLine = position.line;
        const next2Lines = targetLines.slice(currentLine, currentLine + 2).join('\n');

        const itemNext2 = new vscode.CompletionItem(
          'barron-test: แทรกโค้ดบรรทัดถัดไป (Next line)',
          vscode.CompletionItemKind.Snippet
        );
        itemNext2.insertText = next2Lines;
        itemNext2.detail = 'คำแนะนำเขียนโค้ดสำหรับโปรเจกต์ barron-test';
        itemNext2.documentation = new vscode.MarkdownString(`\`\`\`\n${next2Lines}\n\`\`\``);

        const itemAll = new vscode.CompletionItem(
          'barron-test: เติมโค้ดส่วนที่เหลือทั้งหมดในไฟล์นี้',
          vscode.CompletionItemKind.Snippet
        );
        itemAll.insertText = targetLines.slice(currentLine).join('\n');
        itemAll.detail = 'เติมโค้ดที่เหลือทั้งหมดจนจบบริบูรณ์';

        return [itemNext2, itemAll];
      }
    }
  );
  context.subscriptions.push(completionDisposable);

  // 5. Register Sidebar View
  const sidebarProvider = new BarronSidebarViewProvider(context.extensionUri, stateManager);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('barron.guideView', sidebarProvider)
  );

  // 6. Register Commands
  registerCommands(context, stateManager, statusBar, inlineProvider);

  // 7. Watch for Editor & File changes to keep Status Bar in sync and trigger ghost text
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      statusBar.update();
      if (editor) {
        vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
      }
    }),
    vscode.window.onDidChangeTextEditorSelection(() => {
      statusBar.update();
    }),
    vscode.workspace.onDidChangeTextDocument(e => {
      if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
        statusBar.update();
      }
    }),
    vscode.workspace.onDidCreateFiles(() => {
      statusBar.update();
    }),
    stateManager.onDidChangeState(() => {
      statusBar.update();
    })
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};

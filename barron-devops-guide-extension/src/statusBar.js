const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const steps = require('./stepsData');

class BarronStatusBar {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.visible = true;
    // Align to far-left of status bar (priority 10000)
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      10000
    );
    this.statusBarItem.command = 'barron.showMenu';
    this.statusBarItem.show();

    this.update();
  }

  toggle() {
    this.visible = !this.visible;
    if (this.visible) {
      this.statusBarItem.show();
      this.update();
    } else {
      this.statusBarItem.hide();
    }
    return this.visible;
  }

  show() {
    this.visible = true;
    this.statusBarItem.show();
    this.update();
  }

  hide() {
    this.visible = false;
    this.statusBarItem.hide();
  }

  update() {
    if (!this.visible) {
      this.statusBarItem.hide();
      return;
    }

    const currentStep = this.stateManager.getCurrentStep();
    if (!currentStep) {
      this.statusBarItem.text = `$(check) ready`;
      this.statusBarItem.tooltip = undefined;
      this.statusBarItem.backgroundColor = undefined;
      return;
    }

    const total = steps.length;
    const wsFolders = vscode.workspace.workspaceFolders;
    const wsRoot = wsFolders ? wsFolders[0].uri.fsPath : null;

    let fileExists = false;
    let targetFullPath = null;
    if (wsRoot) {
      targetFullPath = path.join(wsRoot, currentStep.targetFile);
      fileExists = fs.existsSync(targetFullPath);
    }

    // Check active editor to see if user is currently writing this file
    const activeEditor = vscode.window.activeTextEditor;
    let isEditingTarget = false;
    let percentage = 0;

    if (activeEditor) {
      const activePath = activeEditor.document.uri.fsPath.replace(/\\/g, '/').toLowerCase();
      const targetNorm = currentStep.targetFile.replace(/\\/g, '/').toLowerCase();
      if (activePath.endsWith('/' + targetNorm) || activePath.endsWith(targetNorm)) {
        isEditingTarget = true;
        const currentLen = activeEditor.document.getText().trim().length;
        const targetLen = currentStep.content.trim().length;
        if (targetLen > 0) {
          percentage = Math.min(100, Math.round((currentLen / targetLen) * 100));
        }
      }
    }

    // แสดงผลแบบ Stealth: แสดงแค่ชื่อไฟล์ล้วน ๆ เพื่อไม่ให้ใครผิดสังเกต เช่น "db.js" หรือ "config/db.js"
    const fileLabel = currentStep.targetFile;
    this.statusBarItem.text = `$(file-code) ${fileLabel}`;
    this.statusBarItem.backgroundColor = undefined;

    this.statusBarItem.tooltip = `Target: ${currentStep.targetFile}`;
  }

  dispose() {
    this.statusBarItem.dispose();
  }
}

module.exports = BarronStatusBar;

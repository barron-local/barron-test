const vscode = require('vscode');
const steps = require('./stepsData');

class BarronSidebarViewProvider {
  constructor(extensionUri, stateManager) {
    this._extensionUri = extensionUri;
    this.stateManager = stateManager;
    this._view = null;

    this.stateManager.onDidChangeState(() => {
      this.updateView();
    });
  }

  resolveWebviewView(webviewView, context, _token) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this.getHtmlContent();

    webviewView.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'createFile':
          vscode.commands.executeCommand('barron.createCurrentFile');
          break;
        case 'insertNext':
          vscode.commands.executeCommand('barron.insertNextChunk');
          break;
        case 'insertAll':
          vscode.commands.executeCommand('barron.insertRemaining');
          break;
        case 'showRef':
          vscode.commands.executeCommand('barron.showReference');
          break;
        case 'nextStep':
          vscode.commands.executeCommand('barron.nextStep');
          break;
        case 'prevStep':
          vscode.commands.executeCommand('barron.prevStep');
          break;
        case 'jumpStep':
          this.stateManager.setCurrentStep(message.stepId);
          break;
        case 'reset':
          vscode.commands.executeCommand('barron.resetProgress');
          break;
      }
    });
  }

  updateView() {
    if (this._view) {
      this._view.webview.html = this.getHtmlContent();
    }
  }

  getHtmlContent() {
    const currentStep = this.stateManager.getCurrentStep();
    const completed = this.stateManager.getCompletedSteps();
    const total = steps.length;
    const progressPercent = Math.round((completed.length / total) * 100);

    const stepsListHtml = steps.map(s => {
      const isDone = completed.includes(s.id);
      const isCurrent = s.id === currentStep.id;

      let statusBadge = '<span class="badge pending">รอดำเนินการ</span>';
      let rowClass = 'step-row';

      if (isDone) {
        statusBadge = '<span class="badge done">เสร็จแล้ว</span>';
        rowClass += ' step-done';
      } else if (isCurrent) {
        statusBadge = '<span class="badge current">กำลังทำ</span>';
        rowClass += ' step-active';
      }

      return `
        <div class="${rowClass}" onclick="jumpToStep(${s.id})">
          <div class="step-num">${s.id}</div>
          <div class="step-info">
            <div class="step-title">${s.title}</div>
            <div class="step-file"><code>${s.targetFile}</code></div>
          </div>
          ${statusBadge}
        </div>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>barron-test</title>
  <style>
    body {
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
      padding: 12px;
      margin: 0;
      line-height: 1.4;
    }
    .header-box {
      margin-bottom: 12px;
    }
    h3 { margin: 0 0 4px 0; font-size: 15px; }
    .sub-title { font-size: 11px; opacity: 0.8; margin-bottom: 10px; }
    
    .progress-container {
      background: var(--vscode-progressBar-background, #333);
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      margin: 8px 0;
    }
    .progress-bar {
      background: #4caf50;
      height: 100%;
      width: ${progressPercent}%;
      transition: width 0.3s;
    }
    .progress-text {
      font-size: 11px;
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .card {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border, #444);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 14px;
    }
    .phase-tag {
      font-size: 10px;
      text-transform: uppercase;
      color: #2196f3;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .card-title {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 6px;
    }
    .file-pill {
      display: inline-block;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 3px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      margin-bottom: 8px;
    }
    .desc {
      font-size: 12px;
      margin-bottom: 8px;
      opacity: 0.9;
    }
    .tips-box {
      background: rgba(255, 193, 7, 0.1);
      border-left: 3px solid #ffc107;
      padding: 6px 8px;
      font-size: 11px;
      margin-bottom: 10px;
      border-radius: 0 4px 4px 0;
    }

    .btn-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 10px;
    }
    .btn-row {
      display: flex;
      gap: 6px;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button.btn-secondary {
      background: var(--vscode-button-secondaryBackground, #444);
      color: var(--vscode-button-secondaryForeground, #fff);
    }
    button.btn-success {
      background: #2e7d32;
      color: #fff;
    }

    .steps-section-title {
      font-size: 12px;
      font-weight: bold;
      margin: 16px 0 8px 0;
      display: flex;
      justify-content: space-between;
    }
    .step-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 4px;
      background: var(--vscode-editor-background);
      border: 1px solid transparent;
    }
    .step-row:hover {
      border-color: var(--vscode-focusBorder);
    }
    .step-active {
      border-color: #2196f3;
      background: rgba(33, 150, 243, 0.1);
    }
    .step-done {
      opacity: 0.7;
    }
    .step-num {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
    }
    .step-info {
      flex: 1;
      overflow: hidden;
    }
    .step-title {
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .step-file {
      font-size: 10px;
      opacity: 0.7;
    }
    .badge {
      font-size: 9px;
      padding: 2px 5px;
      border-radius: 3px;
    }
    .badge.done { background: #2e7d32; color: #fff; }
    .badge.current { background: #1976d2; color: #fff; }
    .badge.pending { background: #666; color: #ccc; }

    .cheat-sheet {
      margin-top: 16px;
      background: var(--vscode-editor-background);
      padding: 10px;
      border-radius: 6px;
      font-size: 11px;
    }
    code {
      font-family: monospace;
      background: rgba(128, 128, 128, 0.2);
      padding: 2px 4px;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <h3>barron-test Guide</h3>
    <div class="sub-title">ระบบแนะนำเขียนโค้ดตามลำดับขั้นตอน</div>

    <div class="progress-container">
      <div class="progress-bar"></div>
    </div>
    <div class="progress-text">
      <span>ความคืบหน้า: ${progressPercent}%</span>
      <span>${completed.length} / ${total} ขั้นตอน</span>
    </div>
  </div>

  <div class="card">
    <div class="phase-tag">${currentStep.phase}</div>
    <div class="card-title">${currentStep.id}. ${currentStep.title}</div>
    <div class="file-pill">${currentStep.targetFile}</div>
    <div class="desc">${currentStep.description}</div>
    <div class="tips-box"><b>คำแนะนำ:</b> ${currentStep.tips}</div>

    <div class="btn-group">
      <div class="btn-row">
        <button onclick="sendCmd('createFile')">สร้างไฟล์นี้</button>
        <button onclick="sendCmd('showRef')" class="btn-secondary">ดูโค้ดเต็ม</button>
      </div>
      <div class="btn-row">
        <button onclick="sendCmd('insertNext')" class="btn-secondary">ใส่โค้ด (Alt+S)</button>
        <button onclick="sendCmd('insertAll')" class="btn-success">ใส่โค้ดทั้งไฟล์</button>
      </div>
      <div class="btn-row">
        <button onclick="sendCmd('prevStep')" class="btn-secondary">ก่อนหน้า</button>
        <button onclick="sendCmd('nextStep')">ถัดไป</button>
      </div>
    </div>
  </div>

  <div class="steps-section-title">
    <span>แผนภาพทุกขั้นตอน (18 Steps)</span>
    <a href="#" onclick="sendCmd('reset')" style="color: #f44336; font-size: 10px; text-decoration: none;">รีเซ็ต</a>
  </div>

  <div class="steps-list">
    ${stepsListHtml}
  </div>

  <div class="cheat-sheet">
    <b>คำสั่งที่ใช้บ่อย:</b><br/>
    • <code>docker compose up -d --build</code> (รันทั้งระบบ)<br/>
    • <code>npm test</code> (รัน Unit/Integration/E2E Test)<br/>
    • เว็บหน้าบ้าน: <code>http://localhost:3001</code><br/>
    • API Backend: <code>http://localhost:5000/api/users</code>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function sendCmd(cmd) {
      vscode.postMessage({ command: cmd });
    }
    function jumpToStep(stepId) {
      vscode.postMessage({ command: 'jumpStep', stepId });
    }
  </script>
</body>
</html>`;
  }
}

module.exports = BarronSidebarViewProvider;

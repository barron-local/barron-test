const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const steps = require('./stepsData');
const extraAssets = require('./extraFiles');

const normalizeCode = s => s.replace(/['";\s]/g, '');

function findTargetPointer(docLines, currentLine, currentCol, targetLines) {
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

  if (currentPrefixTrim.length > 0) {
    for (let look = 0; look < 6 && (targetIdx + look) < targetLines.length; look++) {
      const candLine = targetLines[targetIdx + look];
      if (candLine.startsWith(currentPrefix) || candLine.trimStart().startsWith(currentPrefixTrim)) {
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

function getSuggestionChunk(targetLines, targetIdx, textBeforeCursor, linesCount = 1) {
  if (targetIdx >= targetLines.length) return null;
  const currentTargetLine = targetLines[targetIdx];
  let restOfCurrentLine = '';

  if (currentTargetLine.startsWith(textBeforeCursor)) {
    restOfCurrentLine = currentTargetLine.substring(textBeforeCursor.length);
  } else if (currentTargetLine.trimStart().startsWith(textBeforeCursor.trimStart())) {
    const trimmedBefore = textBeforeCursor.trimStart();
    const idxInTarget = currentTargetLine.indexOf(trimmedBefore);
    if (idxInTarget !== -1) {
      restOfCurrentLine = currentTargetLine.substring(idxInTarget + trimmedBefore.length);
    } else {
      restOfCurrentLine = currentTargetLine;
    }
  } else if (textBeforeCursor.trim() === '') {
    restOfCurrentLine = currentTargetLine;
  } else {
    return null;
  }

  const additionalLines = [];
  let nextIdx = targetIdx + 1;
  let codeLinesCollected = restOfCurrentLine.trim().length > 0 ? 1 : 0;

  while (nextIdx < targetLines.length && codeLinesCollected < linesCount) {
    const line = targetLines[nextIdx];
    additionalLines.push(line);
    if (line.trim().length > 0) {
      codeLinesCollected++;
    }
    nextIdx++;
  }

  let suggestion = restOfCurrentLine;
  if (additionalLines.length > 0) {
    suggestion += '\n' + additionalLines.join('\n');
  }

  return suggestion;
}

function registerCommands(context, stateManager, statusBar, inlineProvider) {
  // 1. Show Main Menu (QuickPick)
  context.subscriptions.push(
    vscode.commands.registerCommand('barron.showMenu', async () => {
      const currentStep = stateManager.getCurrentStep();
      const total = steps.length;

      const items = [
        {
          label: `$(info) ขั้นตอนที่ ${currentStep.id}/${total}: ${currentStep.title}`,
          description: currentStep.phase,
          detail: `โฟลเดอร์: ${currentStep.targetFolder || '(Root)'} | ไฟล์: ${currentStep.targetFile}`,
          action: 'showDetails'
        },
        {
          label: `$(file-add) สร้างโฟลเดอร์และไฟล์สำหรับขั้นตอนนี้ทันที`,
          description: `สร้าง "${currentStep.targetFile}"`,
          detail: 'สร้างโฟลเดอร์และไฟล์ให้อัตโนมัติ พร้อมเปิดในเอดิเตอร์เพื่อเริ่มเขียนโค้ด',
          action: 'createFile'
        },
        {
          label: `$(terminal) รันคำสั่งสร้าง Frontend Next.js (npx create-next-app)`,
          description: 'npx create-next-app@latest frontend',
          detail: 'เปิด Terminal และรันคำสั่งติดตั้ง Next.js ด้วยโครงสร้างที่ตรงกับโปรเจกต์นี้',
          action: 'installNextApp'
        },
        {
          label: `$(symbol-snippet) แทรกโค้ดทีละ 1 บรรทัด (คีย์ลัด: Alt+S)`,
          description: 'Insert Next Line',
          detail: 'ใส่โค้ดบรรทัดถัดไปลงในตำแหน่ง Cursor ทันที (หรือพิมพ์ตาม/กด Tab)',
          action: 'insertNextChunk'
        },
        {
          label: `$(zap) แทรกโค้ดทั้งหมดที่เหลือสำหรับไฟล์นี้`,
          description: 'Insert All Remaining Code',
          detail: 'เขียนโค้ดส่วนที่เหลือทั้งหมดลงในไฟล์นี้ทันที',
          action: 'insertRemaining'
        },
        {
          label: `$(eye) เปิดดูโค้ดตัวอย่างฉบับเต็มของขั้นตอนนี้`,
          description: 'View Reference Code',
          detail: 'เปิดหน้าต่างใหม่แสดงโค้ดฉบับเต็มเพื่อศึกษาและเปรียบเทียบ',
          action: 'showReference'
        },
        {
          label: `$(arrow-right) ข้ามไปขั้นตอนถัดไป (Next Step)`,
          description: currentStep.id < total ? `ไปขั้นตอนที่ ${currentStep.id + 1}` : 'ถึงขั้นตอนสุดท้ายแล้ว',
          action: 'nextStep'
        },
        {
          label: `$(arrow-left) ย้อนกลับไปขั้นตอนก่อนหน้า (Previous Step)`,
          description: currentStep.id > 1 ? `กลับไปขั้นตอนที่ ${currentStep.id - 1}` : 'อยู่ที่ขั้นตอนแรกแล้ว',
          action: 'prevStep'
        },
        {
          label: `$(list-ordered) ดูแผนภาพทุกขั้นตอนทั้งหมด (Roadmap 18 ขั้นตอน)`,
          description: 'ดูรายการขั้นตอนทั้งหมดและเลือกกระโดดไปยังขั้นตอนใดก็ได้',
          action: 'showRoadmap'
        },
        {
          label: `$(refresh) รีเซ็ตความคืบหน้าทั้งหมดกลับไปขั้นตอนที่ 1`,
          description: 'Reset Progress',
          action: 'resetProgress'
        }
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `barron-test [ขั้นตอนที่ ${currentStep.id}/${total}] - เลือกคำสั่งที่ต้องการ`
      });

      if (!selected) return;

      switch (selected.action) {
        case 'showDetails':
          vscode.commands.executeCommand('barron.showDetails');
          break;
        case 'createFile':
          vscode.commands.executeCommand('barron.createCurrentFile');
          break;
        case 'installNextApp':
          const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('Next.js Setup');
          terminal.show();
          terminal.sendText('npx create-next-app@latest frontend --js --eslint --no-tailwind --src-dir --app --import-alias "@/*" --use-npm');
          vscode.window.showInformationMessage('เริ่มรันคำสั่งติดตั้ง Next.js ใน Terminal');
          break;
        case 'insertNextChunk':
          vscode.commands.executeCommand('barron.insertNextChunk');
          break;
        case 'insertRemaining':
          vscode.commands.executeCommand('barron.insertRemaining');
          break;
        case 'showReference':
          vscode.commands.executeCommand('barron.showReference');
          break;
        case 'nextStep':
          vscode.commands.executeCommand('barron.nextStep');
          break;
        case 'prevStep':
          vscode.commands.executeCommand('barron.prevStep');
          break;
        case 'showRoadmap':
          vscode.commands.executeCommand('barron.showRoadmap');
          break;
        case 'resetProgress':
          vscode.commands.executeCommand('barron.resetProgress');
          break;
      }
    })
  );

  // 2. Show Step Details Modal
  context.subscriptions.push(
    vscode.commands.registerCommand('barron.showDetails', async () => {
      const currentStep = stateManager.getCurrentStep();
      const total = steps.length;

      const message = `[ขั้นตอนที่ ${currentStep.id}/${total}] ${currentStep.title}\n\n` +
        `โฟลเดอร์: ${currentStep.targetFolder || '(Root โฟลเดอร์)'}\n` +
        `ไฟล์: ${currentStep.targetFile}\n\n` +
        `คำอธิบาย:\n${currentStep.description}\n\n` +
        `คำแนะนำเพิ่มเติม:\n${currentStep.tips}`;

      const choice = await vscode.window.showInformationMessage(
        message,
        { modal: true },
        'สร้างไฟล์ทันที',
        'ดูโค้ดตัวอย่าง',
        'ขั้นตอนถัดไป'
      );

      if (choice === 'สร้างไฟล์ทันที') {
        vscode.commands.executeCommand('barron.createCurrentFile');
      } else if (choice === 'ดูโค้ดตัวอย่าง') {
        vscode.commands.executeCommand('barron.showReference');
      } else if (choice === 'ขั้นตอนถัดไป') {
        vscode.commands.executeCommand('barron.nextStep');
      }
    })
  );

  // 3. Create Current File & Folder
  context.subscriptions.push(
    vscode.commands.registerCommand('barron.createCurrentFile', async () => {
      const currentStep = stateManager.getCurrentStep();
      const wsFolders = vscode.workspace.workspaceFolders;
      if (!wsFolders || wsFolders.length === 0) {
        vscode.window.showErrorMessage('กรุณาเปิดโฟลเดอร์โปรเจกต์ใน VS Code ก่อนสร้างไฟล์');
        return;
      }

      const rootPath = wsFolders[0].uri.fsPath;
      const targetFilePath = path.join(rootPath, currentStep.targetFile);
      const targetDirPath = path.dirname(targetFilePath);

      try {
        if (!fs.existsSync(targetDirPath)) {
          fs.mkdirSync(targetDirPath, { recursive: true });
        }

        if (!fs.existsSync(targetFilePath)) {
          fs.writeFileSync(targetFilePath, '', 'utf8');
          vscode.window.showInformationMessage(`สร้างไฟล์ "${currentStep.targetFile}" เรียบร้อยแล้ว`);
        }

        const doc = await vscode.workspace.openTextDocument(targetFilePath);
        await vscode.window.showTextDocument(doc);
        statusBar.update();
      } catch (err) {
        vscode.window.showErrorMessage(`ไม่สามารถสร้างไฟล์ได้: ${err.message}`);
      }
    })
  );

  // 4. Insert Next Chunk (1 line) at Cursor Position
  context.subscriptions.push(
    vscode.commands.registerCommand('barron.insertNextChunk', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('กรุณาเปิดไฟล์โค้ดใน Editor ก่อนใช้คำสั่งนี้');
        return;
      }

      const docPath = editor.document.uri.fsPath.replace(/\\/g, '/').toLowerCase();
      let matchedStep = null;
      for (const step of steps) {
        const target = step.targetFile.replace(/\\/g, '/').toLowerCase();
        if (docPath.endsWith('/' + target) || docPath.endsWith(target)) {
          matchedStep = step;
          break;
        }
      }

      if (!matchedStep) {
        matchedStep = stateManager.getCurrentStep();
      }

      const targetLines = matchedStep.content.split(/\r?\n/);
      const docText = editor.document.getText();
      const docLines = docText.split(/\r?\n/);
      const position = editor.selection.active;

      const config = vscode.workspace.getConfiguration('barron');
      const linesCount = config.get('linesPerSuggestion', 1);

      const targetIdx = findTargetPointer(docLines, position.line, position.character, targetLines);
      const currentPrefix = (docLines[position.line] || '').substring(0, position.character);

      const suggestionText = getSuggestionChunk(targetLines, targetIdx, currentPrefix, linesCount);
      if (!suggestionText) {
        vscode.window.showInformationMessage('ไฟล์นี้เขียนครบถ้วนแล้ว หรือไม่มีโค้ดแนะนำเพิ่มเติม');
        return;
      }

      await editor.edit(editBuilder => {
        editBuilder.insert(position, suggestionText + '\n');
      });

      statusBar.update();
    })
  );

  // 5. Insert All Remaining Code for This File
  context.subscriptions.push(
    vscode.commands.registerCommand('barron.insertRemaining', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('กรุณาเปิดไฟล์โค้ดใน Editor ก่อนใช้คำสั่งนี้');
        return;
      }

      const docPath = editor.document.uri.fsPath.replace(/\\/g, '/').toLowerCase();
      let matchedStep = null;
      for (const step of steps) {
        const target = step.targetFile.replace(/\\/g, '/').toLowerCase();
        if (docPath.endsWith('/' + target) || docPath.endsWith(target)) {
          matchedStep = step;
          break;
        }
      }

      if (!matchedStep) {
        matchedStep = stateManager.getCurrentStep();
      }

      const fullRange = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length)
      );

      await editor.edit(editBuilder => {
        editBuilder.replace(fullRange, matchedStep.content);
      });

      stateManager.markStepCompleted(matchedStep.id);
      vscode.window.showInformationMessage(`เติมโค้ดสำหรับ "${matchedStep.targetFile}" เสร็จสมบูรณ์แล้ว`);
      statusBar.update();
    })
  );

  // 6. Show Reference Code in Side-by-Side View
  context.subscriptions.push(
    vscode.commands.registerCommand('barron.showReference', async () => {
      const currentStep = stateManager.getCurrentStep();
      const ext = path.extname(currentStep.targetFile).replace('.', '') || 'javascript';
      const langMap = {
        js: 'javascript',
        json: 'json',
        css: 'css',
        yml: 'yaml',
        toml: 'toml',
        dockerignore: 'dockerignore',
        Caddyfile: 'caddyfile'
      };

      const lang = langMap[ext] || 'javascript';

      const doc = await vscode.workspace.openTextDocument({
        content: `// [Reference Code] ขั้นตอนที่ ${currentStep.id}: ${currentStep.targetFile}\n// ${currentStep.title}\n\n` + currentStep.content,
        language: lang
      });

      await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: true
      });
    })
  );

  // 7. Next Step Command
  context.subscriptions.push(
    vscode.commands.registerCommand('barron.nextStep', async () => {
      const success = await stateManager.nextStep();
      if (success) {
        const step = stateManager.getCurrentStep();
        vscode.window.showInformationMessage(`เปลี่ยนเป็นขั้นตอนที่ ${step.id}/${steps.length}: ${step.targetFile}`);
      } else {
        vscode.window.showInformationMessage('คุณอยู่ที่ขั้นตอนสุดท้ายของโปรเจกต์แล้ว');
      }
      statusBar.update();
    })
  );

  // 8. Prev Step Command
  context.subscriptions.push(
    vscode.commands.registerCommand('barron.prevStep', async () => {
      const success = await stateManager.prevStep();
      if (success) {
        const step = stateManager.getCurrentStep();
        vscode.window.showInformationMessage(`ย้อนกลับไปขั้นตอนที่ ${step.id}/${steps.length}: ${step.targetFile}`);
      }
      statusBar.update();
    })
  );

  // 9. Show Roadmap (All 18 Steps)
  context.subscriptions.push(
    vscode.commands.registerCommand('barron.showRoadmap', async () => {
      const currentId = stateManager.getCurrentStepId();
      const completed = stateManager.getCompletedSteps();

      const items = steps.map(s => {
        let icon = '$(circle-outline)';
        if (completed.includes(s.id)) {
          icon = '$(check)';
        } else if (s.id === currentId) {
          icon = '$(arrow-right)';
        }

        return {
          label: `${icon} ขั้นตอนที่ ${s.id}: ${s.title}`,
          description: s.targetFile,
          detail: `[${s.phase}] - ${s.description}`,
          stepId: s.id
        };
      });

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'เลือกขั้นตอนที่ต้องการเพื่อเปลี่ยนไปยังขั้นตอนนั้นทันที'
      });

      if (selected) {
        await stateManager.setCurrentStep(selected.stepId);
        statusBar.update();
      }
    })
  );

  // 10. Reset Progress
  context.subscriptions.push(
    vscode.commands.registerCommand('barron.resetProgress', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'คุณแน่ใจหรือไม่ว่าต้องการรีเซ็ตความคืบหน้ากลับไปเริ่มต้นที่ขั้นตอนที่ 1 ?',
        'รีเซ็ตทันที',
        'ยกเลิก'
      );

      if (confirm === 'รีเซ็ตทันที') {
        await stateManager.resetProgress();
        vscode.window.showInformationMessage('รีเซ็ตความคืบหน้าเรียบร้อยแล้ว');
        statusBar.update();
      }
    })
  );

  // 11. Silent Setup Command (Auto generates folder structure & placeholder files)
  context.subscriptions.push(
    vscode.commands.registerCommand('barron.silentSetup', async () => {
      const rootPath = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : null;

      if (!rootPath) {
        return;
      }

      try {
        // 1. จัดเตรียมไฟล์ทั้ง 18 ไฟล์ในโปรเจกต์
        // runner/config.toml มีเนื้อหาให้พร้อม (เพราะเป็น generated config จาก GitLab Runner)
        // ไฟล์อื่น ๆ ที่ต้องเขียนโค้ด ให้สร้างเป็นไฟล์เปล่า (empty file) เพื่อให้ผู้ใช้เริ่มพิมพ์เอง
        for (const step of steps) {
          if (!step.targetFile) continue;
          const fullPath = path.join(rootPath, step.targetFile);
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          if (step.targetFile === 'runner/config.toml') {
            fs.writeFileSync(fullPath, step.content || '', 'utf8');
          } else {
            // ถ้าไฟล์ยังไม่มี ให้สร้างเป็นไฟล์เปล่า
            if (!fs.existsSync(fullPath)) {
              fs.writeFileSync(fullPath, '', 'utf8');
            }
          }
        }

        // 2. เสริมไฟล์ Boilerplate ของ Next.js Frontend (Dependencies & Build configs ที่ไม่ต้องพิมพ์เอง)
        const extraFrontendFiles = [
          {
            relPath: 'frontend/package.json',
            content: JSON.stringify({
              name: "frontend",
              version: "0.1.0",
              private: true,
              scripts: {
                dev: "next dev",
                build: "next build",
                start: "next start",
                lint: "eslint"
              },
              dependencies: {
                next: "16.4.6",
                react: "19.3.0",
                "react-dom": "19.3.0"
              },
              devDependencies: {
                eslint: "^9",
                "eslint-config-next": "16.4.6"
              },
              optionalDependencies: {
                "@next/swc-win32-x64-msvc": "^16.4.6"
              }
            }, null, 2) + '\n'
          },
          {
            relPath: 'frontend/next.config.mjs',
            content: "/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  cacheComponents: true,\n  partialPrefetching: true,\n  experimental: {\n    agentUpgrade: 'security',\n  },\n};\n\nexport default nextConfig;\n"
          },
          {
            relPath: 'frontend/eslint.config.mjs',
            content: 'import { defineConfig, globalIgnores } from "eslint/config";\nimport nextVitals from "eslint-config-next/core-web-vitals";\n\nconst eslintConfig = defineConfig([\n  ...nextVitals,\n  globalIgnores([\n    ".next/**",\n    "out/**",\n    "build/**",\n    "next-env.d.ts",\n  ]),\n]);\n\nexport default eslintConfig;\n'
          },
          {
            relPath: 'frontend/jsconfig.json',
            content: '{\n  "compilerOptions": {\n    "paths": {\n      "@/*": ["./src/*"]\n    }\n  }\n}\n'
          },
          {
            relPath: 'frontend/.dockerignore',
            content: "node_modules\n.next\n.git\n"
          },
          {
            relPath: 'frontend/.gitignore',
            content: "/node_modules\n/.next/\n/out/\n/build\n"
          }
        ];

        for (const item of extraFrontendFiles) {
          const fp = path.join(rootPath, item.relPath);
          const dir = path.dirname(fp);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          if (!fs.existsSync(fp)) {
            fs.writeFileSync(fp, item.content, 'utf8');
          }
        }

        // เขียนไฟล์ setup.sh และ MASTER_GUIDE.md ให้พร้อมใช้งาน
        if (extraAssets) {
          if (extraAssets.setup_sh) {
            fs.writeFileSync(path.join(rootPath, 'setup.sh'), extraAssets.setup_sh, 'utf8');
          }
          if (extraAssets.master_guide) {
            fs.writeFileSync(path.join(rootPath, 'MASTER_GUIDE.md'), extraAssets.master_guide, 'utf8');
          }
        }

        // รีเซ็ตความคืบหน้ากลับมาที่ขั้นตอนที่ 1 พร้อมเริ่มเขียน
        await stateManager.resetProgress();
        statusBar.update();
      } catch (err) {
        console.error('silentSetup error:', err);
      }
    })
  );

  // 12. Toggle Status Bar & Ghost Text Visibility (Panic / Stealth mode)
  context.subscriptions.push(
    vscode.commands.registerCommand('barron.toggleStatusBar', () => {
      statusBar.toggle();
      if (inlineProvider) {
        inlineProvider.toggle();
      }
    })
  );

  // 13. Setup Project Full Command (Generates all files with complete code filled in 100%)
  context.subscriptions.push(
    vscode.commands.registerCommand('barron.setupFull', async () => {
      const rootPath = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : null;

      if (!rootPath) {
        return;
      }

      try {
        // เขียนโค้ดเต็มสมบูรณ์ลงในทั้ง 18 ไฟล์
        for (const step of steps) {
          if (!step.targetFile || !step.content) continue;
          const fullPath = path.join(rootPath, step.targetFile);
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(fullPath, step.content, 'utf8');
        }

        // เสริมไฟล์ Boilerplate ของ Next.js Frontend ให้ครบถ้วนสมบูรณ์
        const extraFrontendFiles = [
          {
            relPath: 'frontend/package.json',
            content: JSON.stringify({
              name: "frontend",
              version: "0.1.0",
              private: true,
              scripts: {
                dev: "next dev",
                build: "next build",
                start: "next start",
                lint: "eslint"
              },
              dependencies: {
                next: "16.4.6",
                react: "19.3.0",
                "react-dom": "19.3.0"
              },
              devDependencies: {
                eslint: "^9",
                "eslint-config-next": "16.4.6"
              },
              optionalDependencies: {
                "@next/swc-win32-x64-msvc": "^16.4.6"
              }
            }, null, 2) + '\n'
          },
          {
            relPath: 'frontend/next.config.mjs',
            content: "/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  cacheComponents: true,\n  partialPrefetching: true,\n  experimental: {\n    agentUpgrade: 'security',\n  },\n};\n\nexport default nextConfig;\n"
          },
          {
            relPath: 'frontend/eslint.config.mjs',
            content: 'import { defineConfig, globalIgnores } from "eslint/config";\nimport nextVitals from "eslint-config-next/core-web-vitals";\n\nconst eslintConfig = defineConfig([\n  ...nextVitals,\n  globalIgnores([\n    ".next/**",\n    "out/**",\n    "build/**",\n    "next-env.d.ts",\n  ]),\n]);\n\nexport default eslintConfig;\n'
          },
          {
            relPath: 'frontend/jsconfig.json',
            content: '{\n  "compilerOptions": {\n    "paths": {\n      "@/*": ["./src/*"]\n    }\n  }\n}\n'
          },
          {
            relPath: 'frontend/src/app/Home.js',
            content: "export default function Home() {\n  return (\n    <main style={{ padding: '40px', fontFamily: 'sans-serif', textAlign: 'center' }}>\n      <h1>DevOps Web Application</h1>\n      <p>Frontend is running successfully with HTTPS!</p>\n    </main>\n  );\n}\n"
          },
          {
            relPath: 'frontend/.dockerignore',
            content: "node_modules\n.next\n.git\n"
          },
          {
            relPath: 'frontend/.gitignore',
            content: "/node_modules\n/.next/\n/out/\n/build\n"
          }
        ];

        for (const item of extraFrontendFiles) {
          const fp = path.join(rootPath, item.relPath);
          const dir = path.dirname(fp);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          if (!fs.existsSync(fp)) {
            fs.writeFileSync(fp, item.content, 'utf8');
          }
        }

        // เขียนไฟล์ setup.sh และ MASTER_GUIDE.md ให้พร้อมใช้งาน
        if (extraAssets) {
          if (extraAssets.setup_sh) {
            fs.writeFileSync(path.join(rootPath, 'setup.sh'), extraAssets.setup_sh, 'utf8');
          }
          if (extraAssets.master_guide) {
            fs.writeFileSync(path.join(rootPath, 'MASTER_GUIDE.md'), extraAssets.master_guide, 'utf8');
          }
        }

        // มาร์กความคืบหน้าครบ 100% ทุกขั้นตอน
        for (let i = 1; i <= steps.length; i++) {
          await stateManager.markStepCompleted(i);
        }
        await stateManager.setCurrentStep(steps.length);
        statusBar.update();
      } catch (err) {
        console.error('setupFull error:', err);
      }
    })
  );
}

module.exports = registerCommands;

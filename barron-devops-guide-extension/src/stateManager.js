const vscode = require('vscode');
const steps = require('./stepsData');

class StateManager {
  constructor(context) {
    this.context = context;
    this.onStateChangeEmitter = new vscode.EventEmitter();
    this.onDidChangeState = this.onStateChangeEmitter.event;
  }

  getCurrentStepId() {
    return this.context.workspaceState.get('barron.currentStep', 1);
  }

  getCurrentStep() {
    const id = this.getCurrentStepId();
    return steps.find(s => s.id === id) || steps[0];
  }

  getCompletedSteps() {
    return this.context.workspaceState.get('barron.completedSteps', []);
  }

  isStepCompleted(stepId) {
    const completed = this.getCompletedSteps();
    return completed.includes(stepId);
  }

  async markStepCompleted(stepId, autoAdvance = true) {
    const completed = new Set(this.getCompletedSteps());
    if (!completed.has(stepId)) {
      completed.add(stepId);
      await this.context.workspaceState.update('barron.completedSteps', Array.from(completed));

      // เปลี่ยนไปขั้นตอนถัดไปอัตโนมัติทันทีเงียบ ๆ โดยไม่ต้องเด้งถามหรือกดปุ่ม
      if (autoAdvance && stepId < steps.length) {
        await this.setCurrentStep(stepId + 1);
      }

      this.onStateChangeEmitter.fire();
    }
  }

  async setCurrentStep(stepId) {
    const validId = Math.max(1, Math.min(steps.length, stepId));
    await this.context.workspaceState.update('barron.currentStep', validId);
    this.onStateChangeEmitter.fire();
  }

  async nextStep() {
    const current = this.getCurrentStepId();
    if (current < steps.length) {
      await this.setCurrentStep(current + 1);
      return true;
    }
    return false;
  }

  async prevStep() {
    const current = this.getCurrentStepId();
    if (current > 1) {
      await this.setCurrentStep(current - 1);
      return true;
    }
    return false;
  }

  async resetProgress() {
    await this.context.workspaceState.update('barron.currentStep', 1);
    await this.context.workspaceState.update('barron.completedSteps', []);
    this.onStateChangeEmitter.fire();
  }
}

module.exports = StateManager;

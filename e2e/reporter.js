class CustomReporter {
  constructor() {
    this.passed = 0;
    this.failed = 0;
  }

  onTestEnd(test, result) {
    if (result.status === 'passed') {
      this.passed++;
      console.log(`ok - ${test.title}`);
    } else {
      this.failed++;
      console.log(`not ok - ${test.title}`);
    }
  }

  onEnd(result) {
    if (this.failed === 0) {
      console.log(`\n${this.passed} passed`);
    } else {
      console.log(`\n${this.passed} passed, ${this.failed} failed`);
    }
  }
}

module.exports = CustomReporter;

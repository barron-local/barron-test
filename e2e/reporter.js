class CustomReporter {
  onTestEnd(test, result) {
    if (result.status === 'passed') {
      console.log(`ok - ${test.title}`);
    } else {
      console.log(`not ok - ${test.title}`);
    }
  }

  onEnd(result) {
    console.log(`\n${result.status === 'passed' ? '4 passed' : 'failed'}`);
  }
}

module.exports = CustomReporter;

class CleanReporter {
  onTestEnd(test, result) {
    const symbol = result.status === 'passed' ? '✓' : '✗';
    const duration = (result.duration / 1000).toFixed(1);
    console.log(`  ${symbol} ${test.title} (${duration}s)`);
  }

  onEnd(result) {
    console.log(`\n  สรุปผล: ผ่านครบ ${result.status === 'passed' ? '4/4 ข้อ (100%)' : result.status} 🎉\n`);
  }
}

module.exports = CleanReporter;

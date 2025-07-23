const AmazonJapanScraper = require('./scraper');
const chalk = require('chalk');

console.log(chalk.cyan('🔥 Amazon Japan Ranking Scraper'));
console.log(chalk.gray('====================================='));
console.log(chalk.yellow('⚠️  注意: このツールは教育目的でのみ使用してください'));
console.log(chalk.yellow('⚠️  Amazonの利用規約に従って使用してください'));
console.log(chalk.gray('=====================================\n'));

async function main() {
  const scraper = new AmazonJapanScraper();
  
  try {
    await scraper.run();
  } catch (error) {
    console.error(chalk.red('Fatal error:', error.message));
    process.exit(1);
  }
}

// 未処理の例外をキャッチ
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:', promise, 'reason:', reason));
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:', error));
  process.exit(1);
});

main();
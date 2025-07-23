const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * NGワードチェック機能
 */
class NgWordChecker {
  constructor() {
    this.ngWords = [];
    this.loadNgWords();
  }

  /**
   * NGワードファイルを読み込み
   */
  loadNgWords() {
    const txtPath = path.resolve('NGword.txt');
    const csvPath = path.resolve('NGword.csv');
    
    let filePath = null;
    
    // NGword.txtを優先、なければNGword.csvを確認
    if (fs.existsSync(txtPath)) {
      filePath = txtPath;
    } else if (fs.existsSync(csvPath)) {
      filePath = csvPath;
    }
    
    if (filePath) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        this.ngWords = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#')); // 空行とコメント行を除外
        
        console.log(chalk.blue(`📋 NGワードを${this.ngWords.length}件読み込みました: ${path.basename(filePath)}`));
      } catch (error) {
        console.error(chalk.red(`NGワードファイル読み込みエラー: ${error.message}`));
        this.ngWords = [];
      }
    } else {
      // サンプルファイルを作成
      this.createSampleNgWordFile();
    }
  }

  /**
   * サンプルNGワードファイルを作成
   */
  createSampleNgWordFile() {
    const sampleContent = `# NGワード設定ファイル
# 1行に1つのNGワードを記載してください
# #で始まる行はコメントとして無視されます

アダルト
成人向け
18禁
危険物
薬事法
医薬品
処方薬`;

    const filePath = path.resolve('NGword.txt');
    fs.writeFileSync(filePath, sampleContent, 'utf-8');
    console.log(chalk.yellow(`⚠️  NGword.txtが見つからないため、サンプルファイルを作成しました: ${filePath}`));
    console.log(chalk.yellow('必要に応じてNGワードを編集してから再実行してください。'));
    
    // サンプルのNGワードを読み込み
    this.loadNgWords();
  }

  /**
   * テキストにNGワードが含まれているかチェック
   * @param {string} text - チェック対象のテキスト
   * @returns {Object} { hasNgWord: boolean, matchedWords: string[] }
   */
  checkNgWords(text) {
    if (!text || typeof text !== 'string') {
      return { hasNgWord: false, matchedWords: [] };
    }

    const matchedWords = [];
    const lowerText = text.toLowerCase();

    for (const ngWord of this.ngWords) {
      if (lowerText.includes(ngWord.toLowerCase())) {
        matchedWords.push(ngWord);
      }
    }

    return {
      hasNgWord: matchedWords.length > 0,
      matchedWords: matchedWords
    };
  }

  /**
   * 商品情報全体をチェック
   * @param {Object} product - 商品情報オブジェクト
   * @returns {Object} NGワードチェック結果
   */
  checkProduct(product) {
    const checkTargets = [
      product.商品名 || '',
      product.商品説明 || '',
      product.カテゴリ階層 || ''
    ];

    const allMatchedWords = new Set();
    
    for (const target of checkTargets) {
      const result = this.checkNgWords(target);
      if (result.hasNgWord) {
        result.matchedWords.forEach(word => allMatchedWords.add(word));
      }
    }

    const matchedWordsArray = Array.from(allMatchedWords);
    
    return {
      hasNgWord: matchedWordsArray.length > 0,
      matchedWords: matchedWordsArray,
      ngWordList: matchedWordsArray.join(', ')
    };
  }
}

module.exports = NgWordChecker;
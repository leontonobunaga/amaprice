const fs = require('fs');
const path = require('path');

/**
 * CSV ファイル読み込みユーティリティ
 */
class CsvReader {
  /**
   * CSVファイルからカテゴリ情報を読み込む
   * @param {string} filePath - CSVファイルのパス
   * @returns {Promise<Array>} カテゴリ配列
   */
  static async readCategories(filePath = 'categories.csv') {
    try {
      const fullPath = path.resolve(filePath);
      
      if (!fs.existsSync(fullPath)) {
        throw new Error(`CSVファイルが見つかりません: ${fullPath}`);
      }

      const csvContent = fs.readFileSync(fullPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      // ヘッダー行をスキップ
      const dataLines = lines.slice(1);
      
      const categories = [];
      
      dataLines.forEach((line, index) => {
        const parts = line.split(',').map(item => item.trim());
        const name = parts[0];
        const urls = parts.slice(1).filter(url => url && url.startsWith('http'));
        
        if (name && urls.length > 0) {
          categories.push({
            id: `category_${index + 1}`,
            name: name,
            urls: urls // 複数URLに対応
          });
        }
      });

      return categories;
    } catch (error) {
      console.error('CSVファイルの読み込みエラー:', error.message);
      throw error;
    }
  }

  /**
   * CSVファイルの存在確認
   * @param {string} filePath - CSVファイルのパス
   * @returns {boolean}
   */
  static fileExists(filePath = 'categories.csv') {
    return fs.existsSync(path.resolve(filePath));
  }

  /**
   * サンプルCSVファイルを作成
   * @param {string} filePath - 作成するCSVファイルのパス
   */
  static createSampleCsv(filePath = 'categories.csv') {
    const sampleData = `カテゴリ名,URL1,URL2,URL3
エレクトロニクス,https://www.amazon.co.jp/gp/bestsellers/electronics
本,https://www.amazon.co.jp/gp/bestsellers/books
ファッション,https://www.amazon.co.jp/gp/bestsellers/fashion
ホーム&キッチン,https://www.amazon.co.jp/gp/bestsellers/kitchen
スポーツ&アウトドア,https://www.amazon.co.jp/gp/bestsellers/sports
おもちゃ,https://www.amazon.co.jp/gp/bestsellers/toys
ビューティー,https://www.amazon.co.jp/gp/bestsellers/beauty/5263223051/ref=zg_bs_nav_beauty_1,https://www.amazon.co.jp/gp/bestsellers/beauty/5263225051/ref=zg_bs_nav_beauty_2_5263223051,https://www.amazon.co.jp/gp/bestsellers/beauty/5263270051/ref=zg_bs_nav_beauty_2_5263225051`;

    fs.writeFileSync(path.resolve(filePath), sampleData, 'utf-8');
    console.log(`サンプルCSVファイルを作成しました: ${filePath}`);
  }
}

module.exports = CsvReader;
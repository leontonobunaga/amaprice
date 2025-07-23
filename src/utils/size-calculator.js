/**
 * 商品サイズと重量の計算ユーティリティ
 */
class SizeCalculator {
  /**
   * 重量が500g以内かチェック
   * @param {string} weightString - 重量文字列
   * @returns {boolean}
   */
  static isWeightUnder500g(weightString) {
    if (!weightString || weightString === 'N/A') return false;
    
    const weightMatch = weightString.match(/(\d+(?:\.\d+)?)\s*(?:g|kg|グラム|キログラム)/i);
    if (!weightMatch) return false;
    
    let weightValue = parseFloat(weightMatch[1]);
    if (weightString.toLowerCase().includes('kg') || weightString.includes('キログラム')) {
      weightValue *= 1000; // kgをgに変換
    }
    
    return weightValue <= 500;
  }

  /**
   * 商品サイズを計算 (長さ + 幅 + 高さ)
   * @param {string} dimensionsString - サイズ文字列
   * @returns {number|null}
   */
  static calculateTotalSize(dimensionsString) {
    if (!dimensionsString || dimensionsString === 'N/A') return null;
    
    // 様々な区切り文字に対応
    const dimensionMatch = dimensionsString.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/);
    if (!dimensionMatch) return null;
    
    const length = parseFloat(dimensionMatch[1]);
    const width = parseFloat(dimensionMatch[2]);
    const height = parseFloat(dimensionMatch[3]);
    
    return length + width + height;
  }

  /**
   * サイズが100サイズ以内かチェック
   * @param {string} dimensionsString - サイズ文字列
   * @returns {boolean}
   */
  static isSizeUnder100(dimensionsString) {
    const totalSize = this.calculateTotalSize(dimensionsString);
    return totalSize !== null && totalSize <= 100;
  }

  /**
   * サイズが120サイズ以内かチェック
   * @param {string} dimensionsString - サイズ文字列
   * @returns {boolean}
   */
  static isSizeUnder120(dimensionsString) {
    const totalSize = this.calculateTotalSize(dimensionsString);
    return totalSize !== null && totalSize <= 120;
  }

  /**
   * 全ての条件をチェック
   * @param {string} weight - 重量文字列
   * @param {string} dimensions - サイズ文字列
   * @returns {Object}
   */
  static checkAllConditions(weight, dimensions) {
    return {
      weightUnder500g: this.isWeightUnder500g(weight),
      sizeUnder100: this.isSizeUnder100(dimensions),
      sizeUnder120: this.isSizeUnder120(dimensions),
      totalSize: this.calculateTotalSize(dimensions)
    };
  }
}

module.exports = SizeCalculator;
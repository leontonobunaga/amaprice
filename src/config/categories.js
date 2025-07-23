/**
 * Amazon Japan カテゴリ設定
 */
const categories = {
  'electronics': {
    name: 'エレクトロニクス',
    url: 'https://www.amazon.co.jp/gp/bestsellers/electronics',
    subcategories: [
      'カメラ',
      'スマートフォン',
      'タブレット',
      'パソコン',
      'オーディオ'
    ]
  },
  'books': {
    name: '本',
    url: 'https://www.amazon.co.jp/gp/bestsellers/books',
    subcategories: [
      '文学・評論',
      'ビジネス・経済',
      'コミック',
      '実用書',
      '専門書'
    ]
  },
  'fashion': {
    name: 'ファッション',
    url: 'https://www.amazon.co.jp/gp/bestsellers/fashion',
    subcategories: [
      'メンズ',
      'レディース',
      'キッズ',
      'バッグ',
      'アクセサリー'
    ]
  },
  'home': {
    name: 'ホーム&キッチン',
    url: 'https://www.amazon.co.jp/gp/bestsellers/kitchen',
    subcategories: [
      'キッチン用品',
      'インテリア',
      '家具',
      '収納',
      '掃除用品'
    ]
  },
  'sports': {
    name: 'スポーツ&アウトドア',
    url: 'https://www.amazon.co.jp/gp/bestsellers/sports',
    subcategories: [
      'フィットネス',
      'アウトドア',
      'スポーツウェア',
      'スポーツ用品',
      'アウトドア用品'
    ]
  },
  'toys': {
    name: 'おもちゃ',
    url: 'https://www.amazon.co.jp/gp/bestsellers/toys',
    subcategories: [
      'アクション・トイ',
      'ドール・人形',
      'パズル・ゲーム',
      '電子玩具',
      'ホビー'
    ]
  },
  'beauty': {
    name: 'ビューティー',
    url: 'https://www.amazon.co.jp/gp/bestsellers/beauty',
    subcategories: [
      'スキンケア',
      'メイクアップ',
      'ヘアケア',
      'フレグランス',
      'ボディケア'
    ]
  },
  'health': {
    name: 'ヘルス&ビューティー',
    url: 'https://www.amazon.co.jp/gp/bestsellers/hpc',
    subcategories: [
      'サプリメント',
      'ヘルスケア',
      'オーラルケア',
      '衛生用品',
      '医薬品'
    ]
  }
};

module.exports = categories;
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const inquirer = require('inquirer');
const chalk = require('chalk');
const CsvReader = require('./utils/csv-reader');
const SizeCalculator = require('./utils/size-calculator');

class AmazonJapanScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.allDetailedProducts = [];
    this.categorySummary = [];
  }

  async run() {
    try {
      console.log(chalk.blue('🚀 スクレイピングを開始します...'));
      
      // CSVファイルの存在確認
      if (!CsvReader.fileExists()) {
        console.log(chalk.yellow('⚠️  categories.csvが見つかりません。サンプルファイルを作成します。'));
        CsvReader.createSampleCsv();
        console.log(chalk.green('✅ categories.csvを編集してから再実行してください。'));
        return;
      }

      // カテゴリ情報を読み込み
      const categories = await CsvReader.readCategories();
      console.log(chalk.green(`📋 ${categories.length}個のカテゴリを読み込みました`));

      // ブラウザを起動
      await this.initBrowser();

      // 全カテゴリを処理
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        console.log(chalk.cyan(`\n📂 [${i + 1}/${categories.length}] ${category.name} の処理を開始...`));
        
        try {
          const categoryProducts = [];
          
          // カテゴリの各URLを処理
          for (let urlIndex = 0; urlIndex < category.urls.length; urlIndex++) {
            const url = category.urls[urlIndex];
            console.log(chalk.gray(`   URL ${urlIndex + 1}/${category.urls.length}: ${url}`));
            
            const products = await this.scrapeRanking(url, category.name);
            categoryProducts.push(...products);
            
            if (urlIndex < category.urls.length - 1) {
              await this.delay(2000); // URL間の待機
            }
          }

          // 商品詳細を取得
          const detailedProducts = await this.getDetailedProducts(categoryProducts);
          this.allDetailedProducts.push(...detailedProducts);
          
          this.categorySummary.push({
            name: category.name,
            count: detailedProducts.length
          });

          console.log(chalk.green(`✅ ${category.name}: ${detailedProducts.length}件取得 (累計: ${this.allDetailedProducts.length}件)`));
          
          // カテゴリ間の待機
          if (i < categories.length - 1) {
            console.log(chalk.gray('⏳ 次のカテゴリまで5秒待機...'));
            await this.delay(5000);
          }
          
        } catch (error) {
          console.error(chalk.red(`❌ ${category.name}の処理でエラー: ${error.message}`));
          this.categorySummary.push({
            name: category.name,
            count: 0,
            error: error.message
          });
        }
      }

      // 結果をCSVに保存
      if (this.allDetailedProducts.length > 0) {
        await this.saveToCSV(this.allDetailedProducts, 'all_categories');
        this.displaySummary();
      } else {
        console.log(chalk.red('❌ 取得できた商品データがありません'));
      }

    } catch (error) {
      console.error(chalk.red('Fatal error:', error.message));
      throw error;
    } finally {
      await this.closeBrowser();
    }
  }

  async initBrowser() {
    console.log(chalk.blue('🌐 ブラウザを起動中...'));
    
    // より詳細なブラウザ設定
    this.browser = await puppeteer.launch({
      headless: false, // デバッグのため一時的にfalseに変更
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--window-size=1920,1080'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });
    
    this.page = await this.browser.newPage();
    
    // より詳細なUser-Agent設定
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 追加のヘッダー設定
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });
    
    console.log(chalk.green('✅ ブラウザが正常に起動しました'));
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      console.log(chalk.blue('🔒 ブラウザを終了しました'));
    }
  }

  async scrapeRanking(url, categoryName) {
    try {
      console.log(chalk.gray(`   📊 ランキングページを取得中...`));
      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.delay(2000);

      const content = await this.page.content();
      const $ = cheerio.load(content);
      const products = [];

      // デバッグ: ページタイトルを確認
      const pageTitle = $('title').text();
      console.log(chalk.gray(`   📄 ページタイトル: ${pageTitle}`));

      // ランキング商品を取得（基本情報のみ）
      $('.zg-grid-general-faceout, .zg-item-immersion, .zg-item').each((index, element) => {
        if (index >= 20) return false; // 最大20件

        const $element = $(element);
        const rank = index + 1;
        
        // 商品リンクを取得
        let link = '';
        let asin = '';
        
        // リンクを取得
        const linkElement = $element.find('a[href*="/dp/"]').first();
        if (linkElement.length > 0) {
          link = linkElement.attr('href');
        }
        
        // data-asin属性から直接取得
        if (!link) {
          const dataAsin = $element.attr('data-asin');
          if (dataAsin) {
            link = `/dp/${dataAsin}`;
            asin = dataAsin;
          }
        }
        
        // ASINを抽出
        if (link && !asin) {
          const asinMatch = link.match(/\/dp\/([A-Z0-9]{10})|\/product\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})/);
          if (asinMatch) {
            asin = asinMatch[1] || asinMatch[2] || asinMatch[3];
          }
        }

        // 簡易商品名を取得（詳細は個別ページで取得）
        const name = $element.find('img').attr('alt') || 
                     $element.find('span').first().text().trim() || 
                     `商品${rank}`;
        
        // デバッグ情報
        if (index < 3) {
          console.log(chalk.gray(`   🔍 商品${index + 1}: ASIN="${asin}", リンク="${link ? link.substring(0, 60) : 'なし'}..."`));
        }

        if (asin && link) {
          products.push({
            rank,
            name: name.substring(0, 50),
            asin,
            categoryName,
            detailUrl: link && link.startsWith('http') ? link : `https://www.amazon.co.jp${link || `/dp/${asin}`}`
          });
        }
      });

      console.log(chalk.gray(`   ✅ ${products.length}件の商品を取得`));
      return products;

    } catch (error) {
      console.error(chalk.red(`ランキング取得エラー: ${error.message}`));
      return [];
    }
  }

  async getDetailedProducts(products) {
    const detailedProducts = [];
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(chalk.gray(`   📝 [${i + 1}/${products.length}] ${product.name.substring(0, 30)}... の詳細を取得中`));
      
      try {
        const details = await this.getProductDetails(product);
        if (details) {
          detailedProducts.push(details);
        }
        await this.delay(2000); // リクエスト間隔
      } catch (error) {
        console.error(chalk.red(`商品詳細取得エラー (${product.asin}): ${error.message}`));
      }
    }
    
    return detailedProducts;
  }

  async getProductDetails(product) {
    try {
      console.log(chalk.gray(`      📄 商品詳細ページにアクセス: ${product.detailUrl}`));
      await this.page.goto(product.detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.delay(1000);

      const content = await this.page.content();
      const $ = cheerio.load(content);

      // 商品詳細ページから詳細情報を取得
      const productTitle = $('#productTitle').text().trim() || product.name;
      console.log(chalk.gray(`      📝 商品名: ${productTitle.substring(0, 50)}...`));
      
      const description = this.extractDescription($);
      const categoryBreadcrumb = this.extractCategoryBreadcrumb($);
      const priceInfo = this.extractPriceInfo($);
      const shippingInfo = this.extractShippingInfo($);
      
      // JANコードを抽出
      const productCodes = this.extractJanCode($);
      console.log(chalk.gray(`      🏷️  商品コード: JAN=${productCodes.jan}, UPC=${productCodes.upc}, EAN=${productCodes.ean}, ISBN=${productCodes.isbn}`));
      
      // サイズと重量を抽出
      const sizeWeight = this.extractSizeAndWeight($, description);
      
      // サイズ計算
      const sizeConditions = SizeCalculator.checkAllConditions(sizeWeight.weight, sizeWeight.dimensions);

      // 他サイトの情報を取得（JANコード優先）
      const otherSitesInfo = await this.getOtherSitesInfo(productTitle, productCodes);

      // 最安価格と最短配送を計算
      const comparison = this.calculateBestOptions(priceInfo, shippingInfo, otherSitesInfo);

      return {
        取得日時: new Date().toLocaleString('ja-JP'),
        カテゴリ名: product.categoryName,
        ランキング順位: product.rank,
        商品名: productTitle,
        商品説明: description,
        カテゴリ階層: categoryBreadcrumb,
        価格: priceInfo.currentPrice,
        過去最高価格: priceInfo.highPrice,
        過去最低価格: priceInfo.lowPrice,
        ASINコード: product.asin,
        JANコード: productCodes.jan,
        UPCコード: productCodes.upc,
        EANコード: productCodes.ean,
        ISBNコード: productCodes.isbn,
        プライム対象: shippingInfo.isPrime ? 'はい' : 'いいえ',
        翌日配送: shippingInfo.nextDay ? 'はい' : 'いいえ',
        配送日数: shippingInfo.deliveryDays,
        重さ: sizeWeight.weight,
        サイズ: sizeWeight.dimensions,
        重量500g以内: sizeConditions.weightUnder500g ? 'はい' : 'いいえ',
        '100サイズ以内': sizeConditions.sizeUnder100 ? 'はい' : 'いいえ',
        '120サイズ以内': sizeConditions.sizeUnder120 ? 'はい' : 'いいえ',
        楽天価格: otherSitesInfo.rakuten.price,
        楽天配送: otherSitesInfo.rakuten.delivery,
        楽天URL: otherSitesInfo.rakuten.url,
        Yahoo価格: otherSitesInfo.yahoo.price,
        Yahoo配送: otherSitesInfo.yahoo.delivery,
        YahooURL: otherSitesInfo.yahoo.url,
        ヨドバシ価格: otherSitesInfo.yodobashi.price,
        ヨドバシ配送: otherSitesInfo.yodobashi.delivery,
        ヨドバシURL: otherSitesInfo.yodobashi.url,
        ヤマダ価格: otherSitesInfo.yamada.price,
        ヤマダ配送: otherSitesInfo.yamada.delivery,
        ヤマダURL: otherSitesInfo.yamada.url,
        ビック価格: otherSitesInfo.bic.price,
        ビック配送: otherSitesInfo.bic.delivery,
        ビックURL: otherSitesInfo.bic.url,
        最安価格: comparison.bestPrice,
        最安サイト: comparison.bestPriceSite,
        最短配送: comparison.fastestDelivery,
        最短配送サイト: comparison.fastestDeliverySite
      };

    } catch (error) {
      console.error(chalk.red(`商品詳細取得エラー: ${error.message}`));
      return null;
    }
  }

  extractDescription($) {
    const descriptions = [];
    
    // 複数の説明要素を取得
    $('#feature-bullets ul li span, #productDescription p, .a-unordered-list .a-list-item').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10 && !text.includes('詳細はこちら')) {
        descriptions.push(text);
      }
    });
    
    return descriptions.slice(0, 3).join('     ') || 'N/A';
  }

  extractCategoryBreadcrumb($) {
    const breadcrumbs = [];
    $('#wayfinding-breadcrumbs_feature_div a, .a-breadcrumb a').each((i, el) => {
      const text = $(el).text().trim();
      if (text && !text.includes('›')) {
        breadcrumbs.push(text);
      }
    });
    return breadcrumbs.join(' > ') || 'N/A';
  }

  extractPriceInfo($) {
    const currentPriceElement = $('.a-price-whole, .a-offscreen, #priceblock_dealprice, #priceblock_ourprice').first();
    const currentPrice = currentPriceElement.text().trim().replace(/[^\d,]/g, '') || 'N/A';
    
    // 過去の価格情報（存在する場合）
    const highPriceElement = $('.a-text-strike, .a-price.a-text-price.a-size-base.a-color-secondary').first();
    const highPrice = highPriceElement.text().trim().replace(/[^\d,]/g, '') || 'N/A';
    
    return {
      currentPrice,
      highPrice: highPrice !== currentPrice ? highPrice : 'N/A',
      lowPrice: 'N/A' // Amazonページからは取得困難
    };
  }

  extractShippingInfo($) {
    const shippingText = $('#deliveryBlockMessage, #mir-layout-DELIVERY_BLOCK, .a-color-success, .a-color-price').text();
    
    const isPrime = shippingText.includes('Prime') || $('.a-icon-prime').length > 0;
    const nextDay = shippingText.includes('明日') || shippingText.includes('翌日');
    
    // 配送日数を抽出
    let deliveryDays = 'N/A';
    const dayMatches = shippingText.match(/(\d+)日/g);
    if (dayMatches && dayMatches.length > 0) {
      const days = dayMatches.map(match => parseInt(match.replace('日', '')));
      const minDay = Math.min(...days);
      const maxDay = Math.max(...days);
      deliveryDays = minDay === maxDay ? `${minDay}日` : `${minDay}日-${maxDay}日`;
    }
    
    return {
      isPrime,
      nextDay,
      deliveryDays
    };
  }

  extractJanCode($) {
    const productCodes = {
      jan: 'N/A',
      upc: 'N/A', 
      ean: 'N/A',
      isbn: 'N/A'
    };
    
    // 商品説明からJANコードを検索
    const descriptionText = $('body').text();
    
    // 各コードタイプのパターン
    const codePatterns = {
      jan: [
        /JAN[:\s]*([0-9]{13}|[0-9]{8})/i,
        /商品コード[:\s]*([0-9]{13}|[0-9]{8})/i,
        /バーコード[:\s]*([0-9]{13}|[0-9]{8})/i
      ],
      upc: [
        /UPC[:\s]*([0-9]{12})/i,
        /UPC-A[:\s]*([0-9]{12})/i
      ],
      ean: [
        /EAN[:\s]*([0-9]{13}|[0-9]{8})/i,
        /EAN-13[:\s]*([0-9]{13})/i,
        /EAN-8[:\s]*([0-9]{8})/i
      ],
      isbn: [
        /ISBN[:\s]*([0-9]{13}|[0-9]{10})/i,
        /ISBN-13[:\s]*([0-9]{13})/i,
        /ISBN-10[:\s]*([0-9]{10})/i
      ]
    };
    
    // 各コードタイプを検索
    Object.keys(codePatterns).forEach(codeType => {
      for (const pattern of codePatterns[codeType]) {
        const match = descriptionText.match(pattern);
        if (match && match[1]) {
          productCodes[codeType] = match[1];
          break;
        }
      }
    });
    
    // 詳細テーブルからも検索
    $('#productDetails_detailBullets_sections1 tr, #productDetails_techSpec_section_1 tr, .pdTab tr').each((i, row) => {
      const $row = $(row);
      const label = $row.find('td:first-child, th:first-child').text().trim();
      const value = $row.find('td:last-child, td:nth-child(2)').text().trim();
      
      // JAN
      if (productCodes.jan === 'N/A' && label.match(/JAN|商品コード|バーコード/i)) {
        const codeMatch = value.match(/[0-9]{8,13}/);
        if (codeMatch) {
          productCodes.jan = codeMatch[0];
        }
      }
      
      // UPC
      if (productCodes.upc === 'N/A' && label.match(/UPC/i)) {
        const codeMatch = value.match(/[0-9]{12}/);
        if (codeMatch) {
          productCodes.upc = codeMatch[0];
        }
      }
      
      // EAN
      if (productCodes.ean === 'N/A' && label.match(/EAN/i)) {
        const codeMatch = value.match(/[0-9]{8,13}/);
        if (codeMatch) {
          productCodes.ean = codeMatch[0];
        }
      }
      
      // ISBN
      if (productCodes.isbn === 'N/A' && label.match(/ISBN/i)) {
        const codeMatch = value.match(/[0-9]{10,13}/);
        if (codeMatch) {
          productCodes.isbn = codeMatch[0];
        }
      }
    });
    
    return productCodes;
  }

  // 最適な検索キーワードを決定
  getBestSearchKeyword(productTitle, productCodes) {
    // 優先順位: JAN > UPC > EAN > ISBN > 商品名
    if (productCodes.jan !== 'N/A') {
      console.log(chalk.gray(`      🔍 JANコードで検索: ${productCodes.jan}`));
      return { keyword: productCodes.jan, type: 'JAN' };
    }
    if (productCodes.upc !== 'N/A') {
      console.log(chalk.gray(`      🔍 UPCコードで検索: ${productCodes.upc}`));
      return { keyword: productCodes.upc, type: 'UPC' };
    }
    if (productCodes.ean !== 'N/A') {
      console.log(chalk.gray(`      🔍 EANコードで検索: ${productCodes.ean}`));
      return { keyword: productCodes.ean, type: 'EAN' };
    }
    if (productCodes.isbn !== 'N/A') {
      console.log(chalk.gray(`      🔍 ISBNコードで検索: ${productCodes.isbn}`));
      return { keyword: productCodes.isbn, type: 'ISBN' };
    }
    
    console.log(chalk.gray(`      🔍 商品名で検索: ${productTitle.substring(0, 30)}...`));
    return { keyword: productTitle.substring(0, 50), type: '商品名' };
  }

  extractSizeAndWeight($, description) {
    let weight = 'N/A';
    let dimensions = 'N/A';
    
    // 商品説明から抽出を試行
    const descPatterns = {
      weight: [
        /内容量[:\s]*([0-9.]+(?:g|kg|ml|l|グラム|キログラム|ミリリットル|リットル))/i,
        /重量[:\s]*([0-9.]+(?:g|kg|グラム|キログラム))/i,
        /重さ[:\s]*([0-9.]+(?:g|kg|グラム|キログラム))/i
      ],
      dimensions: [
        /サイズ[:\s]*([0-9.]+\s*[x×*]\s*[0-9.]+\s*[x×*]\s*[0-9.]+)/i,
        /寸法[:\s]*([0-9.]+\s*[x×*]\s*[0-9.]+\s*[x×*]\s*[0-9.]+)/i
      ]
    };
    
    // 商品説明から抽出
    for (const pattern of descPatterns.weight) {
      const match = description.match(pattern);
      if (match && match[1]) {
        weight = match[1];
        break;
      }
    }
    
    for (const pattern of descPatterns.dimensions) {
      const match = description.match(pattern);
      if (match && match[1]) {
        dimensions = match[1];
        break;
      }
    }
    
    // 詳細テーブルから抽出
    if (weight === 'N/A' || dimensions === 'N/A') {
      $('#productDetails_detailBullets_sections1 tr, #productDetails_techSpec_section_1 tr, .pdTab tr').each((i, row) => {
        const $row = $(row);
        const label = $row.find('td:first-child, th:first-child').text().trim();
        const value = $row.find('td:last-child, td:nth-child(2)').text().trim();
        
        if (weight === 'N/A' && label.match(/重量|重さ|内容量/i)) {
          weight = value;
        }
        
        if (dimensions === 'N/A' && label.match(/サイズ|寸法|梱包サイズ/i)) {
          dimensions = value;
        }
      });
    }
    
    return { weight, dimensions };
  }

  async getOtherSitesInfo(productName, productCodes) {
    const sites = {
      rakuten: { price: 'N/A', delivery: 'N/A', url: 'N/A' },
      yahoo: { price: 'N/A', delivery: 'N/A', url: 'N/A' },
      yodobashi: { price: 'N/A', delivery: 'N/A', url: 'N/A' },
      yamada: { price: 'N/A', delivery: 'N/A', url: 'N/A' },
      bic: { price: 'N/A', delivery: 'N/A', url: 'N/A' }
    };

    // 最適な検索キーワードを決定
    const searchInfo = this.getBestSearchKeyword(productName, productCodes);
    
    try {
      // 楽天市場
      sites.rakuten = await this.searchRakuten(searchInfo.keyword, searchInfo.type);
      await this.delay(2000);
      
      // Yahoo!ショッピング
      sites.yahoo = await this.searchYahoo(searchInfo.keyword, searchInfo.type);
      await this.delay(2000);
      
      // ヨドバシ.com
      sites.yodobashi = await this.searchYodobashi(searchInfo.keyword, searchInfo.type);
      await this.delay(2000);
      
      // ヤマダデンキ
      sites.yamada = await this.searchYamada(searchInfo.keyword, searchInfo.type);
      await this.delay(2000);
      
      // ビックカメラ
      sites.bic = await this.searchBic(searchInfo.keyword, searchInfo.type);
      await this.delay(2000);
      
    } catch (error) {
      console.error(chalk.yellow(`他サイト検索エラー: ${error.message}`));
    }

    return sites;
  }

  async searchRakuten(query, searchType) {
    try {
      console.log(chalk.gray(`        🛒 楽天で${searchType}検索: ${query.substring(0, 20)}...`));
      const searchUrl = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(query)}`;
      await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      
      const content = await this.page.content();
      const $ = cheerio.load(content);
      
      const firstItem = $('.searchresultitem').first();
      if (firstItem.length === 0) return { price: 'N/A', delivery: 'N/A', url: 'N/A' };
      
      const price = firstItem.find('.important').text().trim().replace(/[^\d,]/g, '') || 'N/A';
      const delivery = firstItem.find('.delivery').text().trim() || 'N/A';
      const url = firstItem.find('a').attr('href') || 'N/A';
      
      return { price, delivery, url };
    } catch (error) {
      return { price: 'N/A', delivery: 'N/A', url: 'N/A' };
    }
  }

  async searchYahoo(query, searchType) {
    try {
      console.log(chalk.gray(`        🛒 Yahooで${searchType}検索: ${query.substring(0, 20)}...`));
      const searchUrl = `https://shopping.yahoo.co.jp/search?p=${encodeURIComponent(query)}`;
      await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      
      const content = await this.page.content();
      const $ = cheerio.load(content);
      
      const firstItem = $('.Product').first();
      if (firstItem.length === 0) return { price: 'N/A', delivery: 'N/A', url: 'N/A' };
      
      const price = firstItem.find('.Product__price').text().trim().replace(/[^\d,]/g, '') || 'N/A';
      const delivery = firstItem.find('.Product__delivery').text().trim() || 'N/A';
      const url = firstItem.find('a').attr('href') || 'N/A';
      
      return { price, delivery, url: url.startsWith('http') ? url : `https://shopping.yahoo.co.jp${url}` };
    } catch (error) {
      return { price: 'N/A', delivery: 'N/A', url: 'N/A' };
    }
  }

  async searchYodobashi(query, searchType) {
    try {
      console.log(chalk.gray(`        🛒 ヨドバシで${searchType}検索: ${query.substring(0, 20)}...`));
      const searchUrl = `https://www.yodobashi.com/category/search/?word=${encodeURIComponent(query)}`;
      await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      
      const content = await this.page.content();
      const $ = cheerio.load(content);
      
      const firstItem = $('.pListItem').first();
      if (firstItem.length === 0) return { price: 'N/A', delivery: 'N/A', url: 'N/A' };
      
      const price = firstItem.find('.pPrice').text().trim().replace(/[^\d,]/g, '') || 'N/A';
      const delivery = firstItem.find('.pDelivery').text().trim() || 'N/A';
      const url = firstItem.find('a').attr('href') || 'N/A';
      
      return { price, delivery, url: url.startsWith('http') ? url : `https://www.yodobashi.com${url}` };
    } catch (error) {
      return { price: 'N/A', delivery: 'N/A', url: 'N/A' };
    }
  }

  async searchYamada(query, searchType) {
    try {
      console.log(chalk.gray(`        🛒 ヤマダで${searchType}検索: ${query.substring(0, 20)}...`));
      const searchUrl = `https://www.yamada-denkiweb.com/search/?word=${encodeURIComponent(query)}`;
      await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      
      const content = await this.page.content();
      const $ = cheerio.load(content);
      
      const firstItem = $('.p-result-item').first();
      if (firstItem.length === 0) return { price: 'N/A', delivery: 'N/A', url: 'N/A' };
      
      const price = firstItem.find('.p-result-item__price').text().trim().replace(/[^\d,]/g, '') || 'N/A';
      const delivery = firstItem.find('.p-result-item__delivery').text().trim() || 'N/A';
      const url = firstItem.find('a').attr('href') || 'N/A';
      
      return { price, delivery, url: url.startsWith('http') ? url : `https://www.yamada-denkiweb.com${url}` };
    } catch (error) {
      return { price: 'N/A', delivery: 'N/A', url: 'N/A' };
    }
  }

  async searchBic(query, searchType) {
    try {
      console.log(chalk.gray(`        🛒 ビックで${searchType}検索: ${query.substring(0, 20)}...`));
      const searchUrl = `https://www.biccamera.com/bc/category/search/?q=${encodeURIComponent(query)}`;
      await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      
      const content = await this.page.content();
      const $ = cheerio.load(content);
      
      const firstItem = $('.bcs_item').first();
      if (firstItem.length === 0) return { price: 'N/A', delivery: 'N/A', url: 'N/A' };
      
      const price = firstItem.find('.bcs_price').text().trim().replace(/[^\d,]/g, '') || 'N/A';
      const delivery = firstItem.find('.bcs_delivery').text().trim() || 'N/A';
      const url = firstItem.find('a').attr('href') || 'N/A';
      
      return { price, delivery, url: url.startsWith('http') ? url : `https://www.biccamera.com${url}` };
    } catch (error) {
      return { price: 'N/A', delivery: 'N/A', url: 'N/A' };
    }
  }

  calculateBestOptions(amazonPrice, amazonShipping, otherSites) {
    const allPrices = [
      { site: 'Amazon', price: amazonPrice.currentPrice, delivery: amazonShipping.deliveryDays }
    ];

    // 他サイトの価格を追加
    Object.entries(otherSites).forEach(([siteName, info]) => {
      if (info.price !== 'N/A') {
        allPrices.push({
          site: siteName,
          price: info.price,
          delivery: info.delivery
        });
      }
    });

    // 最安価格を計算
    let bestPrice = 'N/A';
    let bestPriceSite = 'N/A';
    let minPrice = Infinity;

    allPrices.forEach(item => {
      const numPrice = parseInt(item.price.replace(/[^\d]/g, ''));
      if (!isNaN(numPrice) && numPrice < minPrice) {
        minPrice = numPrice;
        bestPrice = item.price;
        bestPriceSite = item.site;
      }
    });

    // 最短配送を計算
    let fastestDelivery = 'N/A';
    let fastestDeliverySite = 'N/A';
    let minDays = Infinity;

    allPrices.forEach(item => {
      if (item.delivery !== 'N/A') {
        const dayMatch = item.delivery.match(/(\d+)/);
        if (dayMatch) {
          const days = parseInt(dayMatch[1]);
          if (days < minDays) {
            minDays = days;
            fastestDelivery = item.delivery;
            fastestDeliverySite = item.site;
          }
        }
      }
    });

    return {
      bestPrice,
      bestPriceSite,
      fastestDelivery,
      fastestDeliverySite
    };
  }

  async saveToCSV(products, categoryName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `amazon_ranking_${categoryName}_${timestamp}.csv`;

    const csvWriter = createCsvWriter({
      path: filename,
      header: [
        { id: '取得日時', title: '取得日時' },
        { id: 'カテゴリ名', title: 'カテゴリ名' },
        { id: 'ランキング順位', title: 'ランキング順位' },
        { id: '商品名', title: '商品名' },
        { id: '商品説明', title: '商品説明' },
        { id: 'カテゴリ階層', title: 'カテゴリ階層' },
        { id: '価格', title: '価格' },
        { id: '過去最高価格', title: '過去最高価格' },
        { id: '過去最低価格', title: '過去最低価格' },
        { id: 'ASINコード', title: 'ASINコード' },
        { id: 'JANコード', title: 'JANコード' },
        { id: 'プライム対象', title: 'プライム対象' },
        { id: '翌日配送', title: '翌日配送' },
        { id: '配送日数', title: '配送日数' },
        { id: '重さ', title: '重さ' },
        { id: 'サイズ', title: 'サイズ' },
        { id: '重量500g以内', title: '重量500g以内' },
        { id: '100サイズ以内', title: '100サイズ以内' },
        { id: '120サイズ以内', title: '120サイズ以内' },
        { id: '楽天価格', title: '楽天価格' },
        { id: '楽天配送', title: '楽天配送' },
        { id: '楽天URL', title: '楽天URL' },
        { id: 'Yahoo価格', title: 'Yahoo価格' },
        { id: 'Yahoo配送', title: 'Yahoo配送' },
        { id: 'YahooURL', title: 'YahooURL' },
        { id: 'ヨドバシ価格', title: 'ヨドバシ価格' },
        { id: 'ヨドバシ配送', title: 'ヨドバシ配送' },
        { id: 'ヨドバシURL', title: 'ヨドバシURL' },
        { id: 'ヤマダ価格', title: 'ヤマダ価格' },
        { id: 'ヤマダ配送', title: 'ヤマダ配送' },
        { id: 'ヤマダURL', title: 'ヤマダURL' },
        { id: 'ビック価格', title: 'ビック価格' },
        { id: 'ビック配送', title: 'ビック配送' },
        { id: 'ビックURL', title: 'ビックURL' },
        { id: '最安価格', title: '最安価格' },
        { id: '最安サイト', title: '最安サイト' },
        { id: '最短配送', title: '最短配送' },
        { id: '最短配送サイト', title: '最短配送サイト' }
      ]
    });

    await csvWriter.writeRecords(products);
    console.log(chalk.green(`\n📄 CSVファイルを保存しました: ${filename}`));
    console.log(chalk.blue(`📊 総取得件数: ${products.length}件`));
  }

  displaySummary() {
    console.log(chalk.cyan('\n📋 カテゴリ別取得結果:'));
    console.log(chalk.gray('================================'));
    
    this.categorySummary.forEach(category => {
      if (category.error) {
        console.log(chalk.red(`❌ ${category.name}: エラー (${category.error})`));
      } else {
        console.log(chalk.green(`✅ ${category.name}: ${category.count}件`));
      }
    });
    
    const totalSuccess = this.categorySummary.reduce((sum, cat) => sum + (cat.count || 0), 0);
    console.log(chalk.gray('================================'));
    console.log(chalk.cyan(`📊 総取得件数: ${totalSuccess}件`));
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AmazonJapanScraper;
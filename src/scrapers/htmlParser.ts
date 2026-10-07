import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

// Інтерфейс для даних товару
interface ProductData {
  title: string;
  description: string;
  publisher: string;
  price: string;
  imageUrls: string[];
}

// Іменовані HTML-сутності, які трапляються в описах
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', minus: '−', hellip: '…',
  laquo: '«', raquo: '»', bdquo: '„', ldquo: '“', rdquo: '”',
  lsquo: '‘', rsquo: '’', sbquo: '‚', prime: '′', Prime: '″',
  copy: '©', reg: '®', trade: '™', deg: '°', times: '×',
  middot: '·', bull: '•', sect: '§', para: '¶', shy: '',
  euro: '€'
};

// Перетворюємо HTML-сутності (&mdash; &rsquo; &#8211; &#x2014; …) у звичайні символи
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z][a-z0-9]{1,31});/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const num = code[1] === 'x' || code[1] === 'X'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return num > 0 && num <= 0x10ffff ? String.fromCodePoint(num) : entity;
    }
    return NAMED_ENTITIES[code] ?? entity;
  });
}

export class HtmlParser {
  // Витягуємо дані з HTML сторінки
  parseProductHtml(html: string): ProductData {
    console.log('📄 Парсимо HTML...\n');

    // 1️⃣ Витягуємо назву з мета тегу itemprop="name"
    let titleMatch = html.match(/<meta\s+itemprop="name"\s+content="([^"]+)"/i);
    let title = titleMatch ? titleMatch[1].trim() : '';

    // Якщо не знайшли, шукаємо в <h1>
    if (!title) {
      titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      title = titleMatch ? titleMatch[1].trim() : 'Невідомо';
    }
    console.log('📝 Назва:', title);

    // 2️⃣ Витягуємо описання з мета тегу itemprop="description"
    let descMatch = html.match(/itemprop="description"\s+content="([^"]{1,5000})"/i);
    let description = descMatch ? descMatch[1].trim() : '';

    // Якщо не знайшли, шукаємо як текст
    if (!description) {
      descMatch = html.match(/<div[^>]*description[^>]*>([^<]{1,1000})<\/div>/i);
      description = descMatch ? descMatch[1].trim() : '';
    }
    console.log('📄 Опис знайдено');

    // 3️⃣ Витягуємо видавництво з Brand schema
    const publisherMatch = html.match(/<div\s+itemprop="brand"[^>]*itemtype="[^"]*Brand"[^>]*>[\s\S]*?<meta\s+itemprop="name"\s+content="([^"]+)"/i);
    const publisher = publisherMatch ? publisherMatch[1].trim() : '';
    console.log('📚 Видавництво:', publisher || 'не знайдено');

    // 4️⃣ Витягуємо ціну з мета тегу itemprop="price"
    const priceMatch = html.match(/<meta\s+itemprop="price"\s+content="([^"]+)"/i);
    const price = priceMatch ? priceMatch[1].trim() : '';
    console.log('💰 Ціна:', price || 'не знайдено');

    // 5️⃣ Витягуємо картинки з <meta property="og:image"> + <link itemprop="image">
    const imageUrls: string[] = [];
    let match;

    // Спочатку додаємо og:image (головна картинка)
    const ogImageRegex = /<meta\s+property="og:image"\s+content="([^"]+)"/gi;
    while ((match = ogImageRegex.exec(html)) !== null) {
      let url = match[1];
      if (!url.includes('placeholder') && !url.includes('logo')) {
        // Залишаємо query параметри як є - вони потрібні для Wix
        imageUrls.push(url);
      }
    }

    // Потім додаємо link itemprop="image" (решта картинок)
    const linkImgRegex = /<link\s+itemprop="image"\s+href="([^"]+)"/gi;
    while ((match = linkImgRegex.exec(html)) !== null) {
      let url = match[1];
      if (!url.includes('placeholder') && !url.includes('logo')) {
        // Замінюємо домен на cloud.bookopt.com.ua
        url = url.replace(/https?:\/\/bookopt\.com\.ua/i, 'https://cloud.bookopt.com.ua');
        // Замінюємо /product/ на /product// (подвійний слеш)
        url = url.replace(/\/product\//i, '/product//');
        imageUrls.push(url);
      }
    }

    // Якщо все ще не знайшли, шукаємо в <img>
    if (imageUrls.length === 0) {
      const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
      while ((match = imgRegex.exec(html)) !== null) {
        let url = match[1];
        if (!url.includes('placeholder') && !url.includes('logo')) {
          url = url.replace(/https?:\/\/bookopt\.com\.ua/i, 'https://cloud.bookopt.com.ua');
          url = url.replace(/\/product\//i, '/product//');
          imageUrls.push(url);
        }
      }
    }

    console.log(`🖼️  Знайдено ${imageUrls.length} картинок:`);
    imageUrls.forEach((url, i) => {
      console.log(`   ${i + 1}. ${url}`);
      console.log(`      └─ Довжина: ${url.length} символів`);
      console.log(`      └─ Перша частина: ${url.substring(0, 80)}`);
    });

    return {
      title: decodeHtmlEntities(title),
      description: decodeHtmlEntities(description),
      publisher: decodeHtmlEntities(publisher),
      price,
      imageUrls
    };
  }

  // Завантажуємо картинки з URL
  async downloadImages(imageUrls: string[], outputDir?: string): Promise<string[]> {
    // Якщо папка не задана, використовуємо default
    if (!outputDir) {
      outputDir = './downloaded_images';
    }

    // Створюємо папку якщо її немає
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`✅ Створена папка: ${outputDir}`);
    }

    const downloadedPaths: string[] = [];

    console.log(`\n📥 Завантажуємо ${imageUrls.length} картинок...`);

    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      try {
        // Конвертуємо URL в абсолютний (якщо це відносний URL)
        const absoluteUrl = this.makeAbsoluteUrl(url);

        // Завантажуємо картинку
        const response = await fetch(absoluteUrl);
        const buffer = await response.buffer();

        // Генеруємо ім'я файлу
        const filename = `image_${i + 1}.jpg`;
        const filepath = path.join(outputDir, filename);

        // Зберігаємо файл
        fs.writeFileSync(filepath, buffer);
        downloadedPaths.push(filepath);

        console.log(`   ✅ ${i + 1}/${imageUrls.length} - ${filename}`);
      } catch (error) {
        console.log(`   ❌ ${i + 1}/${imageUrls.length} - помилка завантаження`);
      }
    }

    console.log(`\n✅ Завантажено ${downloadedPaths.length} картинок!`);
    return downloadedPaths;
  }

  // Конвертуємо відносний URL в абсолютний
  private makeAbsoluteUrl(url: string): string {
    if (url.startsWith('http')) {
      return url;
    }
    if (url.startsWith('//')) {
      return 'https:' + url;
    }
    if (url.startsWith('/')) {
      return 'https://bookopt.com.ua' + url;
    }
    return 'https://bookopt.com.ua/' + url;
  }
}

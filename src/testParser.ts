import { HtmlParser } from './scrapers/htmlParser';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const parser = new HtmlParser();

  try {
    // Читаємо HTML файл
    const htmlFilePath = path.join(__dirname, '../Книга Еміля.html');

    if (!fs.existsSync(htmlFilePath)) {
      throw new Error(`❌ Файл не знайдено: ${htmlFilePath}`);
    }

    console.log('📖 Читаємо HTML файл...\n');
    const html = fs.readFileSync(htmlFilePath, 'utf-8');

    // Парсимо HTML
    console.log('=== ПАРСИНГ HTML ===\n');
    const productData = parser.parseProductHtml(html);

    console.log('\n✅ РЕЗУЛЬТАТИ:\n');
    console.log('📝 Назва:', productData.title);
    console.log('📚 Видавництво:', productData.publisher);
    console.log('🖼️  Знайдено картинок:', productData.imageUrls.length);

    console.log('\n=== ДЕТАЛЬНА ІНФОРМАЦІЯ ПРО КАРТИНКИ ===\n');
    productData.imageUrls.forEach((url, i) => {
      console.log(`\n#${i + 1}:`);
      console.log(`  Повна URL: ${url}`);
      console.log(`  Довжина: ${url.length} символів`);
      console.log(`  Починається з: ${url.substring(0, 50)}`);
      console.log(`  Закінчується на: ${url.substring(url.length - 50)}`);
      console.log(`  Містить query параметри: ${url.includes('?') ? 'ДА' : 'НІ'}`);
      console.log(`  Містить /product//: ${url.includes('/product//') ? 'ДА' : 'НІ'}`);
    });

  } catch (error) {
    console.error('❌ ПОМИЛКА:', error);
    process.exit(1);
  }
}

main();

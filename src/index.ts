import { HtmlParser } from './scrapers/htmlParser';
import { WixAutomation } from './services/wixAutomation';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const parser = new HtmlParser();
  const siteId = process.env.WIX_SITE_ID || '857d96b3-5a91-4742-9ebd-c864fafc1710';
  const email = process.env.WIX_EMAIL || 'ruslan.berezenskyi@gmail.com';
  const password = process.env.WIX_PASSWORD || '';

  const automation = new WixAutomation(siteId);

  try {
    // 1️⃣ Читаємо HTML файл
    const htmlFilePath = path.join(__dirname, '../Книга Еміля.html');

    if (!fs.existsSync(htmlFilePath)) {
      throw new Error(`❌ Файл не знайдено: ${htmlFilePath}`);
    }

    console.log('📖 Читаємо HTML файл...\n');
    const html = fs.readFileSync(htmlFilePath, 'utf-8');

    // 2️⃣ Парсимо HTML
    console.log('=== ПАРСИНГ HTML ===\n');
    const productData = parser.parseProductHtml(html);

    console.log('\n✅ ТОВАР ВИТЯГНУТО:\n');
    console.log('📝 Назва:', productData.title);
    console.log('📚 Видавництво:', productData.publisher);
    console.log('📄 Опис:', productData.description.substring(0, 100) + '...');
    console.log('🖼️  Картинок:', productData.imageUrls.length);

    // 3️⃣ Завантажуємо картинки
    console.log('\n=== ЗАВАНТАЖЕННЯ КАРТИНОК ===\n');
    await parser.downloadImages(productData.imageUrls);

    // 4️⃣ Запускаємо браузер
    console.log('\n=== АВТОМАТИЗАЦІЯ WIX ===\n');
    await automation.launch();

    // 5️⃣ Логіниємось у Wix
    if (!password) {
      throw new Error('❌ WIX_PASSWORD не встановлено в .env!');
    }
    const loginSuccess = await automation.login(email, password);

    if (loginSuccess) {
      // 6️⃣ Створюємо товар
      await automation.createProduct(productData);
    }

    // 7️⃣ Чекаємо перед закриттям
    await automation.close();

  } catch (error) {
    console.error('❌ ПОМИЛКА:', error);
    await automation.close();
    process.exit(1);
  }
}

main();

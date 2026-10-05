import { HtmlParser } from './scrapers/htmlParser';
import { WixAutomation } from './services/wixAutomation';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

function findHtmlFiles(): string[] {
  const booksDir = path.join(__dirname, '../Books_htmls');

  if (!fs.existsSync(booksDir)) {
    throw new Error(`❌ Папка не знайдена: ${booksDir}`);
  }

  const files = fs.readdirSync(booksDir);
  const htmlFiles = files.filter(file => file.endsWith('.html'));

  if (htmlFiles.length === 0) {
    throw new Error(`❌ HTML файлів не знайдено в папці: ${booksDir}`);
  }

  console.log(`📂 Знайдено ${htmlFiles.length} HTML файлів:\n`);
  htmlFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
  });
  console.log();

  return htmlFiles.map(file => path.join(booksDir, file));
}

async function main() {
  const parser = new HtmlParser();
  const siteId = process.env.WIX_SITE_ID || '857d96b3-5a91-4742-9ebd-c864fafc1710';
  const email = process.env.WIX_EMAIL || 'ruslan.berezenskyi@gmail.com';
  const password = process.env.WIX_PASSWORD || '';

  const automation = new WixAutomation(siteId);

  try {
    // 1️⃣ Знаходимо всі HTML файли
    const htmlFilePaths = findHtmlFiles();

    // 2️⃣ Запускаємо браузер один раз
    console.log('=== ЗАПУСК БРАУЗЕРА ===\n');
    await automation.launch();

    // 3️⃣ Логіниємось один раз
    console.log('=== ВХІД У WIX ===\n');
    if (!password) {
      throw new Error('❌ WIX_PASSWORD не встановлено в .env!');
    }
    const loginSuccess = await automation.login(email, password);

    if (!loginSuccess) {
      throw new Error('❌ Не вдалося залогінитися в Wix');
    }

    // 4️⃣ Цикл для кожного товару
    console.log('\n' + '='.repeat(50));
    console.log('📦 ПОЧАТОК СТВОРЕННЯ ТОВАРІВ');
    console.log('='.repeat(50) + '\n');

    for (let i = 0; i < htmlFilePaths.length; i++) {
      const htmlFilePath = htmlFilePaths[i];
      const fileName = path.basename(htmlFilePath);

      try {
        console.log(`\n[${i + 1}/${htmlFilePaths.length}] 📖 Обробка: ${fileName}`);
        console.log('-'.repeat(50));

        if (!fs.existsSync(htmlFilePath)) {
          throw new Error(`❌ Файл не знайдено: ${htmlFilePath}`);
        }

        const html = fs.readFileSync(htmlFilePath, 'utf-8');

        // Парсимо HTML
        console.log('📝 Парсинг HTML...');
        const productData = parser.parseProductHtml(html);

        console.log(`✅ Витягнуто: "${productData.title}"`);
        console.log(`   📚 Видавництво: ${productData.publisher}`);
        console.log(`   🖼️  Картинок: ${productData.imageUrls.length}`);

        // Завантажуємо картинки
        console.log('📥 Завантаження картинок...');
        await parser.downloadImages(productData.imageUrls);
        console.log(`✅ Завантажено ${productData.imageUrls.length} картинок`);

        // Створюємо товар у Wix
        console.log('🚀 Створення товару в Wix...');
        await automation.createProduct(productData);
        console.log(`✅ Товар "${productData.title}" успішно створено!\n`);

      } catch (itemError) {
        console.error(`⚠️  Помилка при обробці ${fileName}:`, itemError);
        console.log('⏭️  Переходимо до наступного товару...\n');
      }
    }

    // 5️⃣ Закриваємо браузер
    console.log('\n' + '='.repeat(50));
    console.log('✅ ВСІ ТОВАРИ УСПІШНО СТВОРЕНО!');
    console.log('='.repeat(50));
    await automation.close();

  } catch (error) {
    console.error('❌ КРИТИЧНА ПОМИЛКА:', error);
    await automation.close();
    process.exit(1);
  }
}

main();

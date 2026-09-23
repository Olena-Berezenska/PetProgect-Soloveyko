import { HtmlParser } from './scrapers/htmlParser';
import * as fs from 'fs';

async function main() {
  const parser = new HtmlParser();

  // ПРИКЛАД HTML (замість цього ви дасте мені реальний HTML)
  const exampleHtml = `
    <html>
      <head><title>Механічний принц</title></head>
      <body>
        <h1>Механічний принц - книга</h1>

        <div class="description">
          <p>Це захопливий науково-фантастичний роман про майбутнє</p>
        </div>

        <div class="publisher">Видавництво: Азбука</div>
        <div class="price">Ціна: 450 грн</div>

        <!-- КАРТИНКИ - це головне! -->
        <img src="https://bookopt.com.ua/images/book1.jpg" alt="Обкладинка">
        <img src="https://bookopt.com.ua/images/book2.jpg" alt="Сторінка 1">
        <img src="/images/book3.jpg" alt="Сторінка 2">
      </body>
    </html>
  `;

  try {
    // 1️⃣ Парсимо HTML
    console.log('=== ПАРСИНГ HTML ===\n');
    const productData = parser.parseProductHtml(exampleHtml);

    console.log('\n=== РЕЗУЛЬТАТ ===');
    console.log(JSON.stringify(productData, null, 2));

    // 2️⃣ Завантажуємо картинки
    console.log('\n=== ЗАВАНТАЖЕННЯ КАРТИНОК ===\n');
    const downloadedPaths = await parser.downloadImages(productData.imageUrls);

    console.log('\n=== КАРТИНКИ ГОТОВІ ===');
    console.log('Збережено в папці: ./downloaded_images');
    console.log('Шляхи до файлів:');
    downloadedPaths.forEach((p) => console.log(`  - ${p}`));
  } catch (error) {
    console.error('❌ Помилка:', error);
  }
}

main();

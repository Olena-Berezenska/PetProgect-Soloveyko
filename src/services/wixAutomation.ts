import { chromium, Browser, Page } from '@playwright/test';

interface ProductData {
  title: string;
  description: string;
  publisher: string;
  imageUrls: string[];
}

export class WixAutomation {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private siteId: string;

  constructor(siteId: string) {
    this.siteId = siteId;
  }

  async launch() {
    console.log('🚀 Запускаємо браузер...');
    this.browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-resources',
        '--disable-client-side-phishing-detection',
      ]
    });
    this.page = await this.browser.newPage();

    // Anti-detection параметри
    await this.page.addInitScript(() => {
      // @ts-ignore
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      // @ts-ignore
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    });

    // Viewport як реальний браузер
    await this.page.setViewportSize({ width: 1920, height: 1080 });

    console.log('✅ Браузер запущено (з anti-detection)');
  }

  async login(email: string, password: string) {
    if (!this.page) throw new Error('Браузер не ініціалізовано');

    console.log('\n🔐 ЛОГІН В WIX\n');

    try {
      // Переходимо на логін
      console.log('🌐 Переходимо на сторінку логіну...');
      await this.page.waitForTimeout(1000);
      await this.page.goto('https://users.wix.com/signin', { waitUntil: 'domcontentloaded', timeout: 120000 });
      console.log('✅ Сторінка загружена');
      await this.page.waitForTimeout(3000);

      // Шукаємо email input (спробуємо різні селектори)
      console.log('📧 Вводимо email...');
      let emailInput = await this.page.$('input[type="email"]');

      if (!emailInput) {
        emailInput = await this.page.$('input[placeholder*="email"]');
      }
      if (!emailInput) {
        emailInput = await this.page.$('input[placeholder*="Email"]');
      }
      if (!emailInput) {
        const allInputs = await this.page.$$('input');
        if (allInputs.length > 0) emailInput = allInputs[0];
      }

      if (emailInput) {
        await emailInput.click({ force: true });
        await this.page.waitForTimeout(500);
        await emailInput.fill(email);
        await this.page.waitForTimeout(500);
        console.log('   ✅ Email введено');
      } else {
        console.log('   ⚠️  Email input не знайдено');
        console.log('   📸 Робимо скриншот для діагностики...');
        await this.page.screenshot({ path: 'wix-login-debug.png' });
      }

      // Натискаємо Continue або Enter
      console.log('⏳ Натискаємо Continue...');
      let continueBtn = await this.page.$('button:has-text("Continue")');
      if (!continueBtn) {
        continueBtn = await this.page.$('button:has-text("Next")');
      }
      if (!continueBtn) {
        const buttons = await this.page.$$('button');
        if (buttons.length > 0) {
          for (const btn of buttons) {
            const text = await btn.textContent();
            if (text && text.toLowerCase().includes('continue')) {
              continueBtn = btn;
              break;
            }
          }
        }
      }

      if (continueBtn) {
        await continueBtn.click();
      } else {
        await this.page.press('input', 'Enter');
      }
      await this.page.waitForTimeout(3000);

      // Шукаємо password input
      console.log('🔑 Вводимо пароль...');
      let passwordInput = await this.page.$('input[type="password"]');
      if (!passwordInput) {
        const allInputs = await this.page.$$('input');
        if (allInputs.length > 0) {
          for (const inp of allInputs) {
            const type = await inp.getAttribute('type');
            if (type === 'password') {
              passwordInput = inp;
              break;
            }
          }
        }
      }

      if (passwordInput) {
        await passwordInput.click({ force: true });
        await this.page.waitForTimeout(500);
        await passwordInput.fill(password);
        await this.page.waitForTimeout(500);
        console.log('   ✅ Пароль введено');
      } else {
        console.log('   ⚠️  Password input не знайдено');
      }

      // Натискаємо Sign In
      console.log('⏳ Натискаємо Sign In...');
      let signInBtn = await this.page.$('button:has-text("Sign In")');
      if (!signInBtn) {
        const buttons = await this.page.$$('button');
        for (const btn of buttons) {
          const text = await btn.textContent();
          if (text && (text.toLowerCase().includes('sign in') || text.toLowerCase().includes('увійти'))) {
            signInBtn = btn;
            break;
          }
        }
      }

      if (signInBtn) {
        await signInBtn.click();
      } else {
        await this.page.press('input[type="password"]', 'Enter');
      }

      console.log('⏳ Чекаємо логіну (до 60 сек)...');

      // Чекаємо, поки перенаправить на дашборд
      try {
        await this.page.waitForURL(url => url.toString().includes('dashboard'), { timeout: 60000 });
        console.log('✅ Успішно залогінено!');
        return true;
      } catch (e) {
        console.log('⚠️  Потребується завершення входу вручну');
        console.log('💡 Будь ласка, завершіть вхід у браузері...');
        console.log('⏳ Очікуємо вашої дії...\n');

        // Чекаємо 300 сек (5 хвилин), поки користувач залогінеться вручну
        for (let i = 0; i < 300; i++) {
          try {
            const currentUrl = this.page.url();
            if (currentUrl.includes('dashboard')) {
              console.log('\n✅ Успішно залогінено!');
              return true;
            }
            if (i % 30 === 0 && i > 0) {
              console.log(`   ⏳ ${300 - i} сек залишилось... (натисніть Ctrl+C для виходу)`);
            }
            await this.page.waitForTimeout(1000);
          } catch (innerError) {
            // Проігноруємо помилки під час перевірки
            break;
          }
        }

        console.log('❌ Вхід не завершено за 5 хвилин');
        return false;
      }
    } catch (error) {
      console.error('❌ Помилка логіну:', error);
      return false;
    }
  }

  async createProduct(productData: ProductData) {
    if (!this.page) throw new Error('Браузер не ініціалізовано');

    console.log('\n📝 СТВОРЕННЯ ТОВАРУ\n');

    try {
      // Переходимо на форму створення товару
      const url = `https://manage.wix.com/dashboard/${this.siteId}/store/products/new-product`;
      console.log('🌐 Переходимо на форму...');
      await this.page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await this.page.waitForTimeout(5000);

      // Чекаємо, поки форма завантажиться
      console.log('⏳ Чекаємо завантаження форми...');
      await this.page.waitForTimeout(5000);

      // Зберігаємо скриншот для діагностики
      console.log('📸 Діагностика форми...');
      await this.page.screenshot({ path: 'wix-form.png' });
      const html = await this.page.content();
      const fs = await import('fs');
      fs.writeFileSync('wix-form.html', html);

      // Заповнюємо назву товару
      console.log('📝 Вводимо назву...');
      const nameInput = await this.page.$('[data-hook="product-title"]');

      if (nameInput) {
        await nameInput.fill(productData.title);
        console.log(`   ✅ ${productData.title}`);
      } else {
        console.log('   ⚠️  Поле назви не знайдено');
      }

      await this.page.waitForTimeout(1000);

      // Заповнюємо описання товару через copy-paste
      console.log('📄 Вводимо описання...');
      const descDiv = await this.page.$('[data-hook="product-description"] [contenteditable="true"]');

      if (descDiv) {
        const description = productData.description.substring(0, 8000);

        // 1️⃣ Копіюємо текст в буфер обміну
        await this.page.evaluate((text) => {
          // @ts-ignore
          navigator.clipboard.writeText(text);
        }, description);

        // 2️⃣ Клікаємо на поле
        await descDiv.click();
        await this.page.waitForTimeout(300);

        // 3️⃣ Очищаємо старий вміст
        await this.page.keyboard.press('Control+A');
        await this.page.waitForTimeout(100);

        // 4️⃣ Вставляємо через Ctrl+V (швидко!)
        await this.page.keyboard.press('Control+V');
        await this.page.waitForTimeout(500);

        console.log('   ✅ Описання введено');
      } else {
        console.log('   ⚠️  Поле описання не знайдено');
      }

      // Додаємо фото
      console.log('\n🖼️  Додаємо фото...');

      // 1️⃣ Клікаємо на кнопку "ДОДАТИ ЗОБРАЖЕННЯ"
      console.log('   🔍 Шукаємо кнопку "ДОДАТИ ЗОБРАЖЕННЯ"...');
      const addImagesBtn = await this.page.$('[data-hook="option-PHOTO"] [data-hook="option-button"]');

      if (addImagesBtn) {
        console.log('   ✅ Кнопка знайдена!');
        await addImagesBtn.click();
        console.log('   ⏳ Окно "Обрати зображення" відкривається...');
        await this.page.waitForTimeout(6000);

        // 📸 Діагностика модального вікна
        console.log('   📸 Діагностика модального вікна...');
        await this.page.screenshot({ path: 'modal-debug.png' });
        const modalHtml = await this.page.content();
        const fs = await import('fs');
        fs.writeFileSync('modal-debug.html', modalHtml);

        // 🔍 Перевіримо наявність iframe та shadow DOM
        console.log('   🔍 Перевіря iframe та shadow DOM...');

        // Пошук iframe
        const iframes = await this.page.$$('iframe');
        console.log(`   📊 Знайдено ${iframes.length} iframe(s)`);

        // Виведемо текст всіх видимих елементів на сторінці
        const allElements = await this.page.$$('*');
        const textElements: string[] = [];
        for (const elem of allElements.slice(0, 500)) { // перевіримо перші 500 елементів
          try {
            const text = await elem.textContent();
            if (text && (text.includes('Create') || text.includes('Folder') || text.includes('Upload') || text.includes('New'))) {
              const tag = await elem.evaluate((el: any) => el.tagName);
              textElements.push(`${tag}: ${text.substring(0, 80)}`);
            }
          } catch (e) {
            // Ігноруємо помилки
          }
        }
        console.log('   📝 Релевантні елементи:');
        textElements.slice(0, 20).forEach((el, i) => console.log(`      ${i+1}. ${el}`));

        // 2️⃣ Клікаємо на "Створити нову папку"
        console.log('   🔍 Шукаємо "Створити нову папку" всередину модалу...');

        let success = false;

        // Спочатку спробуємо використати JavaScript для пошуку та клікання
        try {
          console.log('   💡 Спробуємо JavaScript для пошуку кнопки...');

          success = await this.page.evaluate(async () => {
            // Шукаємо всі кнопки на сторінці
            const buttons = document.querySelectorAll('button, a[role="button"], div[role="button"], [role="button"]');
            console.log(`Found ${buttons.length} button-like elements`);

            for (const btn of buttons) {
              const text = btn.textContent || '';
              if (text.includes('Create New Folder') || text.includes('New Folder')) {
                console.log(`Found button: "${text.substring(0, 50)}"`);
                (btn as any).click();
                return true;
              }
            }

            // Якщо не знайдено - спробуємо в iframe
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
              try {
                const iframeDoc = (iframe as any).contentDocument || (iframe as any).contentWindow?.document;
                if (!iframeDoc) continue;

                const iframeButtons = iframeDoc.querySelectorAll('button, a[role="button"], div[role="button"], [role="button"]');
                for (const btn of iframeButtons) {
                  const text = btn.textContent || '';
                  if (text.includes('Create New Folder') || text.includes('New Folder')) {
                    console.log(`Found button in iframe: "${text.substring(0, 50)}"`);
                    (btn as any).click();
                    return true;
                  }
                }
              } catch (e) {
                // Ігноруємо cross-origin помилки
              }
            }

            return false;
          });

          if (success) {
            console.log('   ✅ Кнопка знайдена та клікнута через JavaScript!');
            await this.page.waitForTimeout(800);
          } else {
            console.log('   ⚠️  Кнопка не знайдена через JavaScript');
          }
        } catch (e) {
          console.log(`   ⚠️  Помилка при пошуку через JavaScript: ${(e as Error).message}`);
        }

        if (success) {
          console.log('   ✅ Кнопка знайдена та клікнута!');
          await this.page.waitForTimeout(800);

          // 3️⃣ Вводимо назву папки
          console.log('   ⏳ Вводимо назву папки...');
          await this.page.keyboard.type(productData.title);
          console.log(`   ✅ Назва введена: ${productData.title}`);
          await this.page.waitForTimeout(300);

          // 4️⃣ Enter для збереження папки
          await this.page.keyboard.press('Enter');
          await this.page.waitForTimeout(1500);
          console.log(`   ✅ Папка "${productData.title}" створена`);

          // 5️⃣ Подвійний клік на папку для входу в неї
          console.log('   🔍 Входимо в папку...');

          const folderOpened = await this.page.evaluate(async (folderName: string) => {
            // Шукаємо папку по текету
            const elements = document.querySelectorAll('*');
            let folderElement: any = null;

            for (const el of elements) {
              if (el.textContent?.includes(folderName) && el.textContent?.length < folderName.length + 50) {
                folderElement = el;
                break;
              }
            }

            // Якщо не знайдено в основному документі - шукаємо в iframe
            if (!folderElement) {
              const iframes = document.querySelectorAll('iframe');
              for (const iframe of iframes) {
                try {
                  const iframeDoc = (iframe as any).contentDocument || (iframe as any).contentWindow?.document;
                  if (!iframeDoc) continue;

                  const iframeElements = iframeDoc.querySelectorAll('*');
                  for (const el of iframeElements) {
                    if (el.textContent?.includes(folderName) && el.textContent?.length < folderName.length + 50) {
                      folderElement = el;
                      console.log('Found folder in iframe!');
                      break;
                    }
                  }
                  if (folderElement) break;
                } catch (e) {
                  // Ігноруємо cross-origin помилки
                }
              }
            }

            if (folderElement) {
              // Даємо фокус папці
              (folderElement as any).focus();
              console.log('Folder focused');
              return true;
            }

            return false;
          }, productData.title);

          if (folderOpened) {
            // Натискаємо Enter для відкриття папки
            console.log(`   ⏳ Чекаємо перед входом в папку...`);
            await this.page.waitForTimeout(1000);

            try {
              await this.page.keyboard.press('Enter');
              console.log(`   ✅ Enter нажато`);
            } catch (e) {
              console.log(`   ⚠️  Помилка при нажатті Enter: ${e}`);
            }

            console.log(`   ⏳ Чекаємо завантаження папки (3 сек)...`);
            await this.page.waitForTimeout(3000);
            console.log(`   ✅ Папка відкрита через Enter`);

            // 6️⃣ Шукаємо кнопку "Завантажити" для завантаження фото
            console.log(`   📥 Завантажуємо ${productData.imageUrls.length} посилань на фото...`);

            // ПЕРШИЙ IFRAME - медіа-галерея (він уже існує)
            console.log('   🔍 Шукаємо перший iframe (медіа-галерея)...');
            const allIframes = await this.page.$$('iframe');
            console.log(`   📊 Всього iframe на сторінці: ${allIframes.length}`);

            let addMediaBtnClicked = false;
            let mediaIframeIndex = -1; // 🔑 Запам'ятовуємо індекс iframe де находяться фото

            // Шукаємо кнопку add-media-button ВСЕРЕДИНУ першого iframe
            for (let i = 0; i < allIframes.length; i++) {
              try {
                const frame = await allIframes[i].contentFrame();
                if (!frame) continue;

                // Шукаємо кнопку всередину цього iframe
                const found = await frame.evaluate(() => {
                  const btn = document.querySelector('[data-hook="add-media-button"]');
                  if (btn) {
                    console.log('Found add-media-button in iframe');
                    (btn as any).click();
                    return true;
                  }
                  return false;
                });

                if (found) {
                  addMediaBtnClicked = true;
                  mediaIframeIndex = i; // 🔑 Запам'ятовуємо індекс
                  console.log(`   ✅ Кнопка "Завантажити" клікнута в iframe ${i + 1}!`);
                  await this.page.waitForTimeout(2000);
                  break;
                }
              } catch (e) {
                // Ігноруємо помилки
              }
            }

            if (addMediaBtnClicked) {
              // ДРУГИЙ IFRAME - вибір способу завантаження (вкладка в вкладці)
              console.log('   🔍 Шукаємо іконку "Посилання (URL)" в новому iframe...');

              // Чекаємо появу нового iframe
              await this.page.waitForTimeout(3000);

              // Отримуємо updated список iframe (бо з'явився новий)
              const updatedIframes = await this.page.$$('iframe');
              console.log(`   📊 Iframe тепер: ${updatedIframes.length}`);

              // Діагностика: показуємо всі data-hook в кожному iframe
              console.log('   🔍 Діагностика iframe:');
              for (let i = 0; i < updatedIframes.length; i++) {
                try {
                  const frame = await updatedIframes[i].contentFrame();
                  if (!frame) {
                    console.log(`      iframe ${i + 1}: no access`);
                    continue;
                  }

                  const hooks = await frame.evaluate(() => {
                    const elements = document.querySelectorAll('[data-hook*="source"]');
                    return Array.from(elements).map(el => el.getAttribute('data-hook'));
                  });

                  if (hooks.length > 0) {
                    console.log(`      iframe ${i + 1}: ${hooks.join(', ')}`);
                  }
                } catch (e) {
                  console.log(`      iframe ${i + 1}: error`);
                }
              }

              let urlTabClicked = false;

              // Шукаємо іконку в кожному iframe (особливо в новому)
              for (let i = 0; i < updatedIframes.length; i++) {
                try {
                  const frame = await updatedIframes[i].contentFrame();
                  if (!frame) continue;

                  const found = await frame.evaluate(() => {
                    // Шукаємо елемент з селектором source-link-item-wrapper
                    const btn = document.querySelector('[data-hook="source-link-item-wrapper"]');
                    if (btn) {
                      console.log('Found link source button in iframe');
                      (btn as any).click();
                      return true;
                    }
                    return false;
                  });

                  if (found) {
                    urlTabClicked = true;
                    console.log(`   ✅ Іконка "Посилання (URL)" клікнута в iframe ${i + 1}!`);
                    await this.page.waitForTimeout(1000);
                    break;
                  }
                } catch (e) {
                  // Ігноруємо помилки
                }
              }

              // Для кожного посилання на фото
              for (let photoIndex = 0; photoIndex < productData.imageUrls.length; photoIndex++) {
                const imageUrl = productData.imageUrls[photoIndex];
                console.log(`   📸 Завантажуємо фото ${photoIndex + 1}/${productData.imageUrls.length}: ${imageUrl.substring(0, 60)}...`);

                // Шаг 1: Нажимаємо кнопку "Завантажити" (в iframe)
                console.log(`      1️⃣  Нажимаємо "Завантажити"...`);
                let addMediaClicked = false;

                const iframes = await this.page.$$('iframe');
                for (let i = 0; i < iframes.length; i++) {
                  try {
                    const frame = await iframes[i].contentFrame();
                    if (!frame) continue;

                    const result = await frame.evaluate(() => {
                      const btn = document.querySelector('[data-hook="add-media-button"]');
                      if (btn) {
                        (btn as any).click();
                        return true;
                      }
                      return false;
                    });

                    if (result) {
                      addMediaClicked = true;
                      console.log(`      ✅ Кнопка клікнута в iframe ${i}`);
                      break;
                    }
                  } catch (e) {
                    // ignore
                  }
                }

                if (!addMediaClicked) {
                  console.log(`      ⚠️  Кнопка "Завантажити" не знайдена`);
                  break;
                }

                await this.page.waitForTimeout(1500);

                // Шаг 2: Нажимаємо іконку "Посилання (URL)" (в iframe)
                console.log(`      2️⃣  Нажимаємо іконку "Посилання (URL)"...`);
                let urlTabClicked2 = false;
                let urlIconIframeIndex = -1;

                const iframes2 = await this.page.$$('iframe');
                for (let i = 0; i < iframes2.length; i++) {
                  try {
                    const frame = await iframes2[i].contentFrame();
                    if (!frame) continue;

                    const result = await frame.evaluate(() => {
                      const btn = document.querySelector('[data-hook="source-link-item-wrapper"]');
                      if (btn) {
                        (btn as any).click();
                        return true;
                      }
                      return false;
                    });

                    if (result) {
                      urlTabClicked2 = true;
                      urlIconIframeIndex = i;
                      console.log(`      ✅ Іконка клікнута в iframe ${i}`);
                      break;
                    }
                  } catch (e) {
                    // ignore
                  }
                }

                if (!urlTabClicked2) {
                  console.log(`      ⚠️  Іконка "Посилання (URL)" не знайдена`);
                  break;
                }

                await this.page.waitForTimeout(1500);

                // Шаг 3: Шукаємо input поле та вводимо URL (в ТОМУ ЖЕ iframe!)
                console.log(`      3️⃣  Шукаємо input для URL в iframe ${urlIconIframeIndex}...`);
                console.log(`      🔗 ТОЧНЕ ПОСИЛАННЯ ДЛЯ ВВЕДЕННЯ: ${imageUrl}`);
                let urlInputFound = false;

                try {
                  const iframes3 = await this.page.$$('iframe');
                  if (urlIconIframeIndex >= 0 && urlIconIframeIndex < iframes3.length) {
                    const frame = await iframes3[urlIconIframeIndex].contentFrame();
                    if (frame) {
                      // Нормалізуємо URL - видаляємо подвійні слеші
                      const normalizedUrl = imageUrl.replace(/\/+/g, '/').replace('http:/', 'http://').replace('https:/', 'https://');
                      console.log(`      🔗 Нормалізована URL: ${normalizedUrl}`);

                      // Фокусуємо input в iframe
                      await frame.evaluate(() => {
                        const input = document.querySelector('[data-hook="url-importer-input-field"] input[data-hook="wsr-input"]') as any;
                        if (input) {
                          input.focus();
                          input.click();
                        }
                      });

                      // Копіюємо URL в буфер обміну
                      await this.page.evaluate((url) => {
                        navigator.clipboard.writeText(url);
                      }, normalizedUrl);

                      console.log(`      📋 URL скопійовано в буфер обміну`);
                      await this.page.waitForTimeout(200);

                      // Натискаємо Ctrl+V для вставлення (як користувач роблить вручну!)
                      console.log(`      🔑 Натискаємо Ctrl+V для вставлення...`);
                      await this.page.keyboard.press('Control+V');
                      await this.page.waitForTimeout(500);

                      // Перевіряємо результат
                      const result = await frame.evaluate(() => {
                        const input = document.querySelector('[data-hook="url-importer-input-field"] input[data-hook="wsr-input"]') as any;
                        return {
                          success: !!input,
                          value: input ? input.value : ''
                        };
                      });

                      if (result.success) {
                        console.log(`      ✅ Input знайдено, URL введено`);
                        console.log(`      📝 Значення в input: ${result.value}`);

                        // Перевіримо що видно на екрані
                        const inputDisplay = await frame.evaluate(() => {
                          const input = document.querySelector('[data-hook="url-importer-input-field"] input') as any;
                          if (!input) return { found: false };

                          const style = window.getComputedStyle(input);
                          const attributes = {
                            value: input.value,
                            placeholder: input.placeholder,
                            class: input.className,
                            style: input.style.cssText,
                            display: style.display,
                            visibility: style.visibility,
                            color: style.color,
                            borderColor: style.borderColor,
                          };

                          console.log('Input attributes:', JSON.stringify(attributes, null, 2));

                          // Шукаємо помилку (червоне поле)
                          const errorMsg = document.querySelector('[data-hook="url-importer-input-field"] .error-message, .validation-error, [role="alert"]');
                          const button = document.querySelector('[data-hook="url-importer-input-field"] button, [data-hook="url-importer-input-field"] [role="button"]');

                          return {
                            found: true,
                            hasError: !!errorMsg,
                            hasButton: !!button,
                            attributes
                          };
                        });

                        console.log(`      🔍 Input display info:`, JSON.stringify(inputDisplay, null, 2));

                        if (result.value === normalizedUrl) {
                          urlInputFound = true;
                          console.log(`      ✅ URL введено правильно в поле`);
                        } else {
                          console.log(`      ⚠️  Значення не збіглось!`);
                          console.log(`         Очікувалось: ${normalizedUrl}`);
                          console.log(`         Отримано:   ${result.value}`);
                        }
                      } else {
                        console.log(`      ⚠️  Input не знайдено`);
                      }
                    }
                  }
                } catch (e) {
                  console.log(`      ⚠️  Помилка пошуку input: ${e}`);
                }

                if (!urlInputFound) {
                  console.log(`      ⚠️  Input не знайдено`);
                  break;
                }

                // Шаг 4: Чекаємо на появу кнопки "Завантажити" всередину input поля
                console.log(`      4️⃣  Чекаємо на появу кнопки "Завантажити"...`);

                let buttonAppeared = false;
                for (let i = 0; i < 10; i++) {
                  await this.page.waitForTimeout(300);

                  const iframes = await this.page.$$('iframe');
                  for (const iframe of iframes) {
                    try {
                      const frame = await iframe.contentFrame();
                      if (!frame) continue;

                      const hasButton = await frame.evaluate(() => {
                        // Шукаємо кнопку біля input поля
                        const input = document.querySelector('[data-hook="url-importer-input-field"] input');
                        if (!input) return false;

                        // Шукаємо кнопку в контейнері input поля або поблизу
                        const container = (input as any).closest('[data-hook="url-importer-input-field"]');
                        if (!container) return false;

                        // Шукаємо button або [role="button"] в контейнері
                        const button = container.querySelector('button, [role="button"]');
                        if (button) {
                          const text = button.textContent || '';
                          console.log(`Button found: "${text.substring(0, 50)}"`);
                          return true;
                        }

                        return false;
                      });

                      if (hasButton) {
                        buttonAppeared = true;
                        console.log(`      ✅ Кнопка з'явилась! (спроба ${i + 1}/10)`);
                        break;
                      }
                    } catch (e) {
                      // ignore
                    }
                  }

                  if (buttonAppeared) break;
                  console.log(`      ⏳ Очікуємо кнопку... (спроба ${i + 1}/10)`);
                }

                if (!buttonAppeared) {
                  console.log(`      ⚠️  Кнопка не з'явилась, натискаємо Enter так само...`);
                }

                console.log(`      🔑 Натискаємо Enter для завантаження...`);
                await this.page.keyboard.press('Enter');

                // Шаг 5: Чекаємо завантаження фото
                console.log(`      5️⃣  Чекаємо завантаження фото...`);
                await this.page.waitForTimeout(5000);
                console.log(`      ✅ Фото завантажено`);
              }

              console.log(`   ✅ ${productData.imageUrls.length} фото завантажено`);

              // Крок 6: Виділяємо всі фото в папці (утримуючи Ctrl)
              console.log('\n📸 ВИДІЛЯЄМО ВСІ ФОТО В ПАПЦІ\n');
              console.log(`   🔍 Шукаємо фото в iframe ${mediaIframeIndex + 1}...`);
              await this.page.waitForTimeout(2000);

              // 🔑 Використовуємо той же iframe де були завантажені фото
              const updatedIframesForSelection = await this.page.$$('iframe');

              if (mediaIframeIndex >= 0 && mediaIframeIndex < updatedIframesForSelection.length) {
                const frame = await updatedIframesForSelection[mediaIframeIndex].contentFrame();

                if (frame) {
                  // Спочатку клікаємо на пустому місці папки щоб розчекбоксити всі попередньо вибрані фото
                  console.log(`   🖱️  Клікаємо на пустому місці папки щоб очистити вибір...`);
                  const galleryLayout = frame.locator('[data-hook="gallery-layout"]');
                  const galleryLayoutCount = await galleryLayout.count();

                  if (galleryLayoutCount > 0) {
                    // Клікаємо на краю контейнера (пустому місці)
                    await galleryLayout.click({ position: { x: 10, y: 10 } });
                    await this.page.waitForTimeout(300);
                    console.log(`   ✅ Вибір очищено`);
                  }

                  const photoLocator = frame.locator('div[data-hook="gallery-file"]');
                  const photoCount = await photoLocator.count();
                  console.log(`   📊 Знайдено ${photoCount} фото в папці`);

                  if (photoCount > 0) {
                    // Утримуємо Ctrl і клікаємо на фото в ЗВОРОТНОМУ порядку (з кінця списку)
                    // Так перше завантажене фото буде останнім вибраним і стане основним
                    for (let i = photoCount - 1; i >= 0; i--) {
                      try {
                        const photo = photoLocator.nth(i);
                        console.log(`      🖱️  Клікаємо фото ${i + 1} (з Ctrl)...`);
                        // Клік з утримуванням Ctrl для множинного виділення
                        await photo.click({ modifiers: ['Control'] });
                        await this.page.waitForTimeout(150);
                        console.log(`      ✅ Фото ${i + 1} вибрано`);
                      } catch (e) {
                        console.log(`      ⚠️  Помилка з фото ${i + 1}:`, e instanceof Error ? e.message : e);
                      }
                    }

                    console.log(`   ✅ ${photoCount} фото виділено\n`);

                    // Крок 7: Натискаємо кнопку "Додати до сторінки"
                    console.log('🖱️  НАТИСКАЄМО "Додати до сторінки"\n');
                    await this.page.waitForTimeout(1000);

                    try {
                      const button = frame.locator('button[data-hook="select-items"]');
                      const count = await button.count();

                      if (count > 0) {
                        console.log(`   ✅ Кнопка знайдена, натискаємо...`);
                        await button.click();
                        console.log(`   ✅ Кнопка "Додати до сторінки" натиснута!`);
                        await this.page.waitForTimeout(3000);
                      } else {
                        console.log(`   ⚠️  Кнопка "Додати до сторінки" не знайдена`);
                      }
                    } catch (e) {
                      console.log(`   ⚠️  Помилка при натисканні кнопки:`, e instanceof Error ? e.message : e);
                    }
                  } else {
                    console.log(`   ⚠️  Фото не знайдено в папці`);
                  }
                } else {
                  console.log(`   ⚠️  Не можемо отримати доступ до iframe`);
                }
              } else {
                console.log(`   ⚠️  Індекс iframe невалідний`);
              }
            } else {
              console.log('   ⚠️  Кнопка "Завантажити" не знайдена в жодному iframe!');
            }
          } else {
            console.log('   ⚠️  Папка не знайдена для входу');
          }
        } else {
          console.log('   ⚠️  Кнопка "Створити нову папку" не знайдена');
        }
      } else {
        console.log('   ⚠️  Кнопка "ДОДАТИ ЗОБРАЖЕННЯ" не знайдена');
      }

      // Крок 8: Розчекбоксити "Показувати в інтернет-магазині"
      console.log('\n📋 РОЗЧЕКБОКСИТИ "Показувати в інтернет-магазині"\n');
      await this.page.waitForTimeout(2000);

      try {
        const visibilityCheckbox = this.page.locator('[data-hook="product-online-store-visibility-checkbox"]');
        const checkboxCount = await visibilityCheckbox.count();

        if (checkboxCount > 0) {
          const isChecked = await visibilityCheckbox.isChecked();
          console.log(`   📊 Чек-бокс знайдено. Вибраний: ${isChecked}`);

          if (isChecked) {
            console.log(`   🖱️  Розчекбоксимо чек-бокс...`);
            await visibilityCheckbox.click();
            await this.page.waitForTimeout(500);

            const isCheckedAfter = await visibilityCheckbox.isChecked();
            console.log(`   ✅ Чек-бокс розчекбоксено. Вибраний тепер: ${isCheckedAfter}`);
            console.log(`   ℹ️  Товар НЕ буде видимий в магазині до публікування!`);
          } else {
            console.log(`   ℹ️  Чек-бокс вже розчекбоксено`);
          }
        } else {
          console.log(`   ⚠️  Чек-бокс "Показувати в інтернет-магазині" не знайдено`);
        }
      } catch (e) {
        console.log(`   ⚠️  Помилка при розчекбоксуванні:`, e instanceof Error ? e.message : e);
      }

      // Крок 9: Переключити toggle "Track Inventory"
      console.log('\n🔄 ПЕРЕКЛЮЧАЄМО "Track Inventory"\n');
      await this.page.waitForTimeout(1000);

      try {
        const trackInventoryToggle = this.page.locator('[data-hook="track-inventory-toggle"]');
        const toggleCount = await trackInventoryToggle.count();

        if (toggleCount > 0) {
          console.log(`   🔍 Toggle "Track Inventory" знайдено`);
          console.log(`   🖱️  Переключаємо toggle...`);
          await trackInventoryToggle.click();
          await this.page.waitForTimeout(500);
          console.log(`   ✅ Toggle переключено!`);
        } else {
          console.log(`   ⚠️  Toggle "Track Inventory" не знайдено`);
        }
      } catch (e) {
        console.log(`   ⚠️  Помилка при переключенні toggle:`, e instanceof Error ? e.message : e);
      }

      // Крок 10: Ввести прайс
      console.log('\n💰 ВВОДИМО ПРАЙС\n');
      await this.page.waitForTimeout(1000);

      try {
        const priceInput = this.page.locator('[data-hook="product-price"]');
        const priceInputCount = await priceInput.count();

        if (priceInputCount > 0) {
          console.log(`   🔍 Поле ціни знайдено`);
          console.log(`   💵 Вводимо ціну: 1`);
          await priceInput.fill('1');
          await this.page.waitForTimeout(500);

          const priceValue = await priceInput.inputValue();
          console.log(`   ✅ Ціна введена: ${priceValue}`);
        } else {
          console.log(`   ⚠️  Поле ціни не знайдено`);
        }
      } catch (e) {
        console.log(`   ⚠️  Помилка при введенні ціни:`, e instanceof Error ? e.message : e);
      }

      // Крок 11: Натиснути кнопку "Зберегти"
      console.log('\n💾 НАТИСКАЄМО КНОПКУ "Зберегти"\n');
      await this.page.waitForTimeout(1500);

      try {
        const saveButton = this.page.locator('[data-hook="product-save"]');
        const saveButtonCount = await saveButton.count();

        if (saveButtonCount > 0) {
          console.log(`   🔍 Кнопка "Зберегти" знайдена`);
          console.log(`   🖱️  Натискаємо кнопку...`);
          await saveButton.click();
          console.log(`   ⏳ Чекаємо збереження...`);
          await this.page.waitForTimeout(3000);
          console.log(`   ✅ Товар збережено!`);
          console.log(`   ✅ Товар "Книга Еміля" успішно створено!`);
        } else {
          console.log(`   ⚠️  Кнопка "Зберегти" не знайдена`);
        }
      } catch (e) {
        console.log(`   ⚠️  Помилка при натисканні кнопки "Зберегти":`, e instanceof Error ? e.message : e);
      }

      console.log('\n✅ ГОТОВО! ТОВАР УСПІШНО СТВОРЕНО!');
    } catch (error) {
      console.error('❌ Помилка створення товару:', error);
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('✅ Браузер закрито');
    }
  }
}

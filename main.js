
const { chromium } = require("playwright");

// Konfigurasi pengujian lokal
const CONFIG = {
  url: "https://habkhyar.vercel.app/blog/membedah-gradient-descent",

  // Batasi jumlah percobaan untuk pengujian (default atau dari env)
 maxAttempts: 1,


  // Jeda antar-submisi dalam milidetik
  delayBetweenAttempts: 2000,

  namePrefix: "Ahahaha ahahahahahahaha ukhukk uhukk",

  // Jika sertifikat HTTPS localhost tidak dipercaya
  ignoreHTTPSErrors: true,

  // Otomatis headless jika di server / CI atau disetel via ENV
  headless: process.env.HEADLESS === "true" || !!process.env.CI,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const browser = await chromium.launch({
    headless: CONFIG.headless,
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: CONFIG.ignoreHTTPSErrors,
  });

  const page = await context.newPage();

  let lastResponseStatus = null;

  // Memantau respons HTTP yang terjadi saat submit
  page.on("response", (response) => {
    const status = response.status();

    if (status === 429) {
      lastResponseStatus = 429;
      console.log(
        `\n[!] Rate limit terdeteksi: HTTP 429 pada ${response.url()}`
      );
    }
  });

  try {
    await page.goto(CONFIG.url, {
      waitUntil: "domcontentloaded",
    });

    console.log(`Halaman siap: ${CONFIG.url}`);
    console.log(`Target percobaan: ${CONFIG.maxAttempts}`);
    console.log(
      `Jeda antar-submisi: ${CONFIG.delayBetweenAttempts} ms\n`
    );

    for (let i = 1; i <= CONFIG.maxAttempts; i++) {
      lastResponseStatus = null;

      try {
        if (i > 1) {
          console.log(`\n[${i}] Membersihkan localStorage dan memuat ulang halaman...`);
          await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
          });
          await page.reload({ waitUntil: "domcontentloaded" });
        } else {
          // Pastikan kondisi awal bersih
          await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
          });
        }

        const form = page.locator("form").filter({
          has: page.locator('textarea[placeholder="What are your thoughts on this article?"]'),
        });

        await form.waitFor({ state: "visible", timeout: 10000 });

        const name = `${CONFIG.namePrefix} ${i}`;
        const comment = `suruh dia`;

        const nameInput = form.locator('input[placeholder="John Doe"]');
        const commentInput = form.locator(
          'textarea[placeholder="What are your thoughts on this article?"]'
        );
        const agreement = form.locator("#agreement");
        const submitButton = form.locator('button[type="submit"]');

        await nameInput.fill(name);
        await commentInput.fill(comment);

        if (!(await agreement.isChecked())) {
          await agreement.check();
        }

        await submitButton.waitFor({ state: "visible", timeout: 5000 });

        if (await submitButton.isDisabled()) {
          console.log(`[${i}] Tombol submit disabled.`);
        } else {
          console.log(`[${i}] Mengirim komentar: "${comment}"`);
          await submitButton.click();

          // Tunggu proses request dan UI selesai
          await sleep(2000);

          if (lastResponseStatus === 429) {
            console.log(`[${i}] Peringatan: Server mengembalikan HTTP 429 (Rate Limit).`);
          } else {
            // Periksa notifikasi toast/alert jika ada
            const toast = page.locator('[role="alert"], [data-sonner-toast], .toast');
            if (await toast.count() > 0) {
              const toastText = await toast.first().innerText();
              console.log(`[${i}] Notifikasi: "${toastText}"`);
            } else {
              console.log(`[${i}] Selesai dikirim.`);
            }
          }
        }
      } catch (err) {
        console.log(`[${i}] Terjadi kendala: ${err.message}`);
      }

      if (i < CONFIG.maxAttempts) {
        console.log(`[${i}] Menunggu jeda ${CONFIG.delayBetweenAttempts} ms...`);
        await sleep(CONFIG.delayBetweenAttempts);
      }
    }

    console.log("\nPengujian selesai.");
  } catch (error) {
    console.error("\nPengujian gagal:", error.message);
  } finally {
    await browser.close();
  }
}

main();

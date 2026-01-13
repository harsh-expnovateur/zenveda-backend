const puppeteer = require("puppeteer");
const { invoiceHtml } = require("./invoiceTemplate");

async function generateInvoicePDF(orderData) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.setContent(invoiceHtml(orderData), {
    waitUntil: "networkidle0",
  });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
  });

  await browser.close();
  return pdfBuffer;
}

module.exports = { generateInvoicePDF };

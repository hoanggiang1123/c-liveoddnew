const puppeteer = require('puppeteer');

const crawler  = {
    browser: null,
    page: null,

    init: async (url) => {

        crawler.browser = await puppeteer.launch({ headless: true, args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // <- this one doesn't works in Windows
            '--disable-gpu'
        ] });

        crawler.page = await crawler.browser.newPage();

        await crawler.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36');

        await crawler.page.goto(url, { waitUntil: 'networkidle2' });
    }
}

module.exports = crawler
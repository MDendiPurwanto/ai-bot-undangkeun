const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeUndangkeun() {
    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto('https://undangkeun.com/', { waitUntil: 'networkidle2' });

        const data = await page.evaluate(() => {
            const getTextContent = (selector) => {
                const elements = document.querySelectorAll(selector);
                return Array.from(elements).map(el => el.textContent.trim()).filter(text => text.length > 0);
            };
            const getAttributes = (selector, attribute) => {
                const elements = document.querySelectorAll(selector);
                return Array.from(elements).map(el => el.getAttribute(attribute)).filter(attr => attr);
            };

            return {
                title: document.title,
                headings: {
                    h1: getTextContent('h1'),
                    h2: getTextContent('h2'),
                    h3: getTextContent('h3')
                },
                paragraphs: getTextContent('p'),
                spans: getTextContent('span'),
                links: getAttributes('a', 'href'),
                images: getAttributes('img', 'src'),
                metaDescription: document.querySelector('meta[name="description"]')?.content || 'Tidak ada deskripsi',
                fullBodyText: document.body.innerText.trim()
            };
        });

        const replaceText = (input) => {
            if (typeof input === 'string') {
                return input.replace(/undangkeun\.myr/g, 'deonesolutions.myr');
            } else if (Array.isArray(input)) {
                return input.map(item => item.replace(/undangkeun\.myr/g, 'deonesolutions.myr'));
            } else if (typeof input === 'object' && input !== null) {
                const newObj = {};
                for (const key in input) {
                    newObj[key] = replaceText(input[key]);
                }
                return newObj;
            }
            return input;
        };

        const modifiedData = replaceText(data);
        fs.writeFileSync('data.json', JSON.stringify(modifiedData, null, 2));
        console.log('Data disimpan ke data.json');
        await browser.close();
        return modifiedData;
    } catch (error) {
        console.error('Error saat scraping:', error);
        return null;
    }
}

scrapeUndangkeun();
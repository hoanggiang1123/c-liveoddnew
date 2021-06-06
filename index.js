const express = require('express');

const app = express();
const http = require('http').createServer(app);

require('dotenv').config();
const puppeteer = require('puppeteer');
process.setMaxListeners(Infinity);

const PORT = 5000 || process.env.PORT;

var whitelist = [process.env.DEV_DOMAIN, process.env.FRONT_DOMAIN];

var corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}


const io = require('socket.io')(http, {
    cors: corsOptions
});

io.on('connection', (socket) => {
    console.log('User connected with socket_id' + socket.id);
});

const redis = require('redis');
const client = redis.createClient();

client.on('connect', function() {
    console.log('Redis client connected');
});

const cron = require('node-cron');

const { getOdds, getOddContent } = require('./tylekeo');

const craw = async () => {

    console.log('cron-odd-run');

    const browser = await puppeteer.launch({ headless: true, args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- this one doesn't works in Windows
        '--disable-gpu'
    ] });


    try {

        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36');

        await page.goto(process.env.TYLEKEO_URL, { waitUntil: 'networkidle2' });


        const [liveDom, normalDom] = await getOddContent(page);
    
        await browser.close();

        let live;
        let normal;
        let data = []

        if (liveDom) live = getOdds(liveDom, 'live-');
        if (normalDom) normal = getOdds(normalDom, 'normal-');

        if (live) data.push(live)
        if (normal) data.push(normal)
        if (data.length) {

            const strOdds = JSON.stringify(data);

            client.set('TY_LE_KEO', strOdds);

            io.emit('SEND_ODD', strOdds);

            return true;
        }

        io.emit('SEND_ERR', []);

    } catch (err) {

        console.log(err.message);

        io.emit('SEND_ERR', err.message);

    } finally {

        browser.close();

        // process.exit();
    }
}
cron.schedule('*/30 * * * * *', async () => {
    await craw();

}, { timezone: "Asia/Ho_Chi_Minh" });

app.get('/tylekeo', async (req, res) => {
    client.get('TY_LE_KEO', function (err, result) {
        if (result) {
            return res.send(result)
        }
        res.send('err');
    })
});


http.listen(PORT, () => console.log('App running on port ' + PORT));

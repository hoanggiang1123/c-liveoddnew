const express = require('express');

const app = express();
const http = require('http').createServer(app);

require('dotenv').config();

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

const crawler = require('./crawler');

const { getOdds, getOddContent } = require('./tylekeo');


cron.schedule('*/30 * * * * *', async () => {
    console.log('cron-odd-run');

    await crawler.init(process.env.TYLEKEO_URL);

    try {
        if (crawler.page) {

            const [liveDom, normalDom] = await getOddContent(crawler.page);
    
            await crawler.browser.close();
    
            let live;
            let normal;
            let data = []
    
            if (liveDom) live = getOdds(liveDom, 'live-');
            if (normalDom) normal = getOdds(normalDom, 'normal-');
    
            if (live) data.push(live)
            if (normal) data.push(normal)
    
            if (data.length) {
                // console.log(data);

                const strOdds = JSON.stringify(data);
    
                client.set('TY_LE_KEO', strOdds);
    
                io.emit('SEND_ODD', strOdds);
    
                return true;
            }
    
            io.emit('SEND_ERR', []);
        }
        await crawler.browser.close();

        io.emit('SEND_ERR', 'can not get page');

    } catch (err) {

        if (crawler.browser) crawler.browser.close();

        console.log(err)

        io.emit('SEND_ERR', err.message);
    }

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

require('dotenv').config();
const Telegraf = require('telegraf');

const SocksAgent = require('socks5-https-client/lib/Agent');

const socksAgent = new SocksAgent({
  socksHost: process.env.PROXY_HOST,
  socksPort: process.env.PROXY_PORT,
  // socksUsername: process.env.PROXY_USER,
  // socksPassword: process.env.PROXY_PASSWORD,
});

const token = process.env.API_TOKEN;

const bot = new Telegraf(token, {
  telegram: { agent: socksAgent },
});

bot.start((ctx) => ctx.reply('Welcome! Send me a sticker))'));
bot.on('sticker', (ctx) => ctx.reply('Thanks, have a good night ❤'));
bot.launch();

console.log('server is running on http://localhost:4000');

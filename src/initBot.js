require('dotenv').config();
const SocksAgent = require('socks5-https-client/lib/Agent');
const Telegraf = require('telegraf');

function initBot(useProxy = false) {
  let bot;
  if (useProxy) {
    const socksAgent = new SocksAgent({
      socksHost: process.env.PROXY_HOST,
      socksPort: process.env.PROXY_PORT,
      socksUsername: process.env.PROXY_USER,
      socksPassword: process.env.PROXY_PASSWORD,
    });

    bot = new Telegraf(process.env.API_TOKEN, {
      telegram: { agent: socksAgent },
    });
  } else {
    bot = new Telegraf(process.env.API_TOKEN);
  }

  return bot;
}

module.exports = initBot;

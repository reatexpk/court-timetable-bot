require('dotenv').config();
const SocksAgent = require('socks5-https-client/lib/Agent');
const Telegraf = require('telegraf');

function initBot() {
  const socksAgent = new SocksAgent({
    socksHost: process.env.PROXY_HOST,
    socksPort: process.env.PROXY_PORT,
    socksUsername: process.env.PROXY_USER,
    socksPassword: process.env.PROXY_PASSWORD,
  });

  const bot = new Telegraf(process.env.API_TOKEN, {
    telegram: { agent: socksAgent },
  });

  return bot;
}

module.exports = initBot;

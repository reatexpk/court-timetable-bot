require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.API_TOKEN;
const proxyHost = process.env.PROXY_HOST;
const proxyPort = process.env.PROXY_PORT;
const proxyUser = process.env.PROXY_USER;
const proxyPassword = process.env.PROXY_PASSWORD;

const config = {
  polling: true,
  request: {
    proxy: `http://${proxyUser}:${proxyPassword}@${proxyHost}:${proxyPort}`,
    strictSSL: false,
  },
};
console.log(config);

const bot = new TelegramBot(token, config);

bot.on('message', (msg) => {
  console.log(msg);
});

// // Matches "/echo [whatever]"
// bot.onText(/\/echo (.+)/, (msg, match) => {
//   // 'msg' is the received Message from Telegram
//   // 'match' is the result of executing the regexp above on the text content
//   // of the message

//   const chatId = msg.chat.id;
//   const resp = match[1]; // the captured "whatever"

//   // send back the matched "whatever" to the chat
//   bot.sendMessage(chatId, resp);
// });

// // Listen for any kind of message. There are different kinds of
// // messages.
// bot.on('message', (msg) => {
//   const chatId = msg.chat.id;

//   // send a message to the chat acknowledging receipt of their message
//   bot.sendMessage(chatId, 'Received your message');
// });

const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const session = require('telegraf/session');
const Stage = require('telegraf/stage');
const Scene = require('telegraf/scenes/base');

const { leave } = Stage;

const greeter = new Scene('greeter');
greeter.enter((ctx) => ctx.reply('Hi'));
greeter.leave((ctx) => ctx.reply('Bye'));
greeter.hears(/hi/gi, leave());
greeter.on('message', (ctx) => ctx.reply('Send `hi`'));

const stage = new Stage();
stage.command('cancel', leave());

stage.register(greeter);

const bot = require('./initBot')();

bot.use(session());
bot.use(stage.middleware());
// bot.start((ctx) => ctx.scene.enter('greeter'));
bot.start((ctx) => {
  const options = {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: 'Кнопка 1', callback_data: 'getData' }],
        [{ text: 'Кнопка 2', callback_data: 'getData' }],
        [{ text: 'Кнопка 3', callback_data: 'getData' }],
      ],
    }),
  };
  const message =
    'Привет!\nДанный бот поможет тебе узнать расписания судов. ' +
    'Выбери дальнейшее действие, используя кнопки снизу.';
  ctx.telegram.sendMessage(ctx.message.chat.id, message, options);
});
bot.on('callback_query', async (ctx) => {
  if (ctx.callbackQuery.data === 'getData') {
    const data = await getData();
    ctx.reply(data);
  }
  ctx.answerCbQuery();
});
bot.startPolling();

// handlers
async function getData() {
  let data = '';
  try {
    const html = await axios({
      method: 'get',
      url:
        'https://verhisetsky--svd.sudrf.ru/modules.php?name=sud_delo&srv_num=1&H_date=18.06.2019',
      responseType: 'stream',
    }).then(async (res) => {
      return new Promise((resolve, reject) =>
        res.data
          .pipe(iconv.decodeStream('win1251'))
          .collect((err, decodedBody) => {
            if (err) {
              reject(err);
            }
            resolve(decodedBody);
          }),
      );
    });

    const $ = cheerio.load(html);
    $('div#resultTable table tr').each((i, elem) => {
      if (i === 1) {
        data = $(elem)
          .find('td.type-header')
          .text();
        console.log('found data', data);
      }
    });
  } catch (err) {
    console.log(err.message);
  }
  return data;
}

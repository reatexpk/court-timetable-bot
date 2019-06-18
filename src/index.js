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
        [{ text: 'Запросить расписание', callback_data: 'getData' }],
      ],
    }),
  };
  const message =
    'Привет!\nДанный бот поможет тебе узнать расписания судов по КоАП 20.2. ' +
    'Выбери дальнейшее действие, используя кнопки снизу.';
  ctx.telegram.sendMessage(ctx.message.chat.id, message, options);
});
bot.on('callback_query', async (ctx) => {
  if (ctx.callbackQuery.data === 'getData') {
    const data = await getData();

    if (!data) {
      ctx.reply('Произошла ошибка при запросе данных с сайта суда.');
    }

    if (!data.length) {
      ctx.reply('Ничего не найдено.');
    }

    let replyString = `*Данные суда на ${data[0].time.slice(0, 10)}*\n\n`;

    data.forEach(({ caseNumber, time, judge, link, info }) => {
      replyString +=
        `ФИО: ${getPersonName(info)}\n` +
        `Номер дела: [${caseNumber}](${link})\n` +
        `Время расcмотрения: ${time}\n` +
        `Судья: ${judge}\n\n`;
    });
    ctx.telegram.sendMessage(ctx.chat.id, replyString, {
      parse_mode: 'markdown',
    });
  }
  ctx.answerCbQuery();
});
bot.startPolling();

// handlers
async function getData() {
  const baseUrl = 'https://verhisetsky--svd.sudrf.ru';
  const date = '19.06.2019';
  const data = [];
  try {
    const html = await axios({
      method: 'get',
      url: `${baseUrl}/modules.php?name=sud_delo&srv_num=1&H_date=${date}`,
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

    const $ = cheerio.load(html, { decodeEntities: false });
    $('div#resultTable table tbody tr').each((i, elem) => {
      if ($(elem).find('td').length !== 1) {
        const children = $(elem).children();
        const orderNumber = children
          .eq(0)
          .text()
          .replace('.', '');
        const caseNumber = children.eq(1).text();
        const link = `${baseUrl}${children
          .eq(1)
          .find('a')
          .attr('href')}`;
        const time = children.eq(2).text();
        const event = children.eq(3).text();
        const room = children.eq(4).text();
        const info = children.eq(5).text();
        const judge = children.eq(6).text();

        data.push({
          orderNumber,
          caseNumber,
          link,
          time: `${date} ${time}`,
          event,
          room,
          info,
          judge,
        });
      }
    });
  } catch (err) {
    console.log(err.message);
    return undefined;
  }

  return filterDataByArticle(data);
}

function filterDataByArticle(data) {
  return data.filter((elem) => elem.info.includes('20.2'));
}

function getPersonName(string) {
  return string.split('-')[0].slice(0, string.length - 1) || '';
}

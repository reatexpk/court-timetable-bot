const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const session = require('telegraf/session');
const Stage = require('telegraf/stage');
const Scene = require('telegraf/scenes/base');
const dayjs = require('dayjs');

const { leave } = Stage;

const selectDate = new Scene('selectDate');
selectDate.enter((ctx) => {
  const options = {
    reply_markup: JSON.stringify({
      keyboard: [
        ['Вчера', 'Сегодня'],
        ['Завтра', 'Послезавтра'],
        // ['Другая дата'],
      ],
      resize_keyboard: true,
    }),
  };
  ctx.telegram.sendMessage(ctx.message.chat.id, 'Выбери дату ниже', options);
});
selectDate.on('message', (ctx) => {
  if (ctx.message.text === 'Вчера') {
    ctx.session.selectedDate = dayjs()
      .subtract(1, 'day')
      .toISOString();
  }
  if (ctx.message.text === 'Сегодня') {
    ctx.session.selectedDate = dayjs().toISOString();
  }
  if (ctx.message.text === 'Завтра') {
    ctx.session.selectedDate = dayjs()
      .add(1, 'day')
      .toISOString();
  }
  if (ctx.message.text === 'Послезавтра') {
    ctx.session.selectedDate = dayjs()
      .add(2, 'day')
      .toISOString();
  }
  ctx.scene.enter('selectCourt');
  // if (ctx.message.text.match(/^\d\d.\d\d.\d\d\d\d$/g)) {
  //   showData(ctx);
  // }
});

const courts = [
  'Верх-Исетский',
  'Ленинский',
  'Железнодорожный',
  'Кировский',
  'Октябрьский',
  'Чкаловский',
  'Орджоникидзевский',
];

const selectCourt = new Scene('selectCourt');
selectCourt.enter((ctx) => {
  const options = {
    reply_markup: JSON.stringify({
      keyboard: [
        ['Верх-Исетский', 'Ленинский'],
        ['Железнодорожный', 'Кировский'],
        ['Октябрьский', 'Чкаловский'],
        ['Орджоникидзевский', 'Выбрать другую дату'],
      ],
      resize_keyboard: true,
    }),
  };
  ctx.telegram.sendMessage(ctx.message.chat.id, 'Выбери суд', options);
});
selectCourt.on('message', async (ctx) => {
  if (courts.includes(ctx.message.text)) {
    ctx.session.court = ctx.message.text;
    await ctx.reply(
      `Запрашиваю данные на ${dayjs(ctx.session.selectedDate).format(
        'DD.MM.YYYY',
      )}, суд: ${ctx.message.text}`,
    );
    await showData(ctx);
    ctx.scene.enter('selectDate');
  }
});

const stage = new Stage();
stage.command('cancel', leave());

stage.register(selectDate);
stage.register(selectCourt);

const bot = require('./initBot')();

bot.use(session());
bot.use(stage.middleware());
bot.start((ctx) => ctx.scene.enter('selectDate'));
bot.startPolling();

async function showData(ctx) {
  const data = await fetchData({
    date: dayjs(ctx.session.selectedDate).format('DD.MM.YYYY'),
    court: ctx.session.court,
  });

  if (!data) {
    await ctx.reply('Произошла ошибка при запросе данных с сайта суда.');
    return;
  }

  if (!data.length) {
    await ctx.reply('Ничего не найдено.');
    return;
  }

  let replyString = `*Данные суда на ${dayjs(ctx.session.selectedDate).format(
    'DD.MM.YYYY',
  )}*\n\n`;

  data.forEach(({ caseNumber, time, judge, link, info }) => {
    replyString +=
      `ФИО: ${getPersonName(info)}\n` +
      `Номер дела: [${caseNumber}](${link})\n` +
      `Время расcмотрения: ${time}\n` +
      `Судья: ${judge}\n\n`;
  });
  await ctx.telegram.sendMessage(ctx.message.chat.id, replyString, {
    parse_mode: 'markdown',
  });
}

// handlers
async function fetchData({ date, court }) {
  const url = getUrlByCourtName(court);
  const data = [];
  try {
    const html = await axios({
      method: 'get',
      url: `${url}&H_date=${date}`,
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
        const link = `${url}${children
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
          time,
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
  return data.filter((elem) => {
    const regexp = /20.2 /g;
    return regexp.test(elem.info);
  });
}

function getPersonName(string) {
  return string.split('-')[0].slice(0, string.length - 1) || '';
}

function getUrlByCourtName(court) {
  switch (court) {
    case 'Верх-Исетский': {
      return 'https://verhisetsky--svd.sudrf.ru/modules.php?name=sud_delo&srv_num=1';
    }
    case 'Ленинский': {
      return 'https://leninskyeka--svd.sudrf.ru/modules.php?name=sud_delo&srv_num=1';
    }
    case 'Железнодорожный': {
      return 'https://zheleznodorozhny--svd.sudrf.ru/modules.php?name=sud_delo&srv_num=2';
    }
    case 'Кировский': {
      return 'https://kirovsky--svd.sudrf.ru/modules.php?name=sud_delo&srv_num=1';
    }
    case 'Октябрьский': {
      return 'https://oktiabrsky--svd.sudrf.ru/modules.php?name=sud_delo&srv_num=1';
    }
    case 'Чкаловский': {
      return 'https://chkalovsky--svd.sudrf.ru/modules.php?name=sud_delo&srv_num=1';
    }
    case 'Орджоникидзевский': {
      return 'https://ordzhonikidzevsky--svd.sudrf.ru/modules.php?name=sud_delo&srv_num=1';
    }
    default: {
      throw new Error('Invalid court name');
    }
  }
}

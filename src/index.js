const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const session = require('telegraf/session');
const Stage = require('telegraf/stage');
const Scene = require('telegraf/scenes/base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const fs = require('fs');
const config = require('./config');

dayjs.extend(utc);

const { leave } = Stage;

const selectDate = new Scene('selectDate');
selectDate.enter(async (ctx) => {
  await fs.appendFile(
    './log.log',
    `[${dayjs()
      .utc()
      .add(5, 'hour')
      .format('DD-MM-YYYY hh:mm:ss')}]: ${ctx.message.from.last_name ||
      ''} ${ctx.message.from.first_name || ''} @${ctx.message.from.username}\n`,
    () => {
      // console.log('file updated');
    },
  );
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
  await ctx.telegram.sendMessage(
    ctx.message.chat.id,
    'Выбери дату ниже',
    options,
  );
});
selectDate.on('message', async (ctx) => {
  if (ctx.message.text === 'Вчера') {
    ctx.session.selectedDate = dayjs()
      .subtract(1, 'day')
      .toISOString();
    ctx.scene.enter('selectCourt');
  } else if (ctx.message.text === 'Сегодня') {
    ctx.session.selectedDate = dayjs().toISOString();
    ctx.scene.enter('selectCourt');
  } else if (ctx.message.text === 'Завтра') {
    ctx.session.selectedDate = dayjs()
      .add(1, 'day')
      .toISOString();
    ctx.scene.enter('selectCourt');
  } else if (ctx.message.text === 'Послезавтра') {
    ctx.session.selectedDate = dayjs()
      .add(2, 'day')
      .toISOString();
    ctx.scene.enter('selectCourt');
  } else if (ctx.message.text === '/start') {
    ctx.scene.reenter();
  } else {
    ctx.scene.reenter();
  }
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
  'Областной',
];

const selectCourt = new Scene('selectCourt');
selectCourt.enter((ctx) => {
  const options = {
    reply_markup: JSON.stringify({
      keyboard: [
        ['Верх-Исетский', 'Ленинский'],
        ['Железнодорожный', 'Кировский'],
        ['Октябрьский', 'Чкаловский'],
        ['Орджоникидзевский', 'Областной'],
        ['Выбрать другую дату'],
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
      `Запрашиваю данные на ${dayjs(ctx.session.selectedDate)
        .utc()
        .add(5, 'hour')
        .format('DD.MM.YYYY')}, суд: ${ctx.message.text}`,
    );
    await showData(ctx);
    ctx.scene.enter('selectDate');
  } else if (ctx.message.text === 'Выбрать другую дату') {
    ctx.scene.enter('selectDate');
  } else {
    ctx.reply('Команда не распознана');
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
bot.on('message', (ctx) => ctx.scene.enter('selectDate'));
bot.startPolling();

async function showData(ctx) {
  await fs.appendFile(
    './log.log',
    `[${dayjs()
      .utc()
      .add(5, 'hour')
      .format('DD-MM-YYYY hh:mm:ss')}]: Запрашиваем данные, суд: ${
      ctx.session.court
    }\n`,
    () => {
      // console.log('file updated');
    },
  );
  const data = await fetchData({
    date: dayjs(ctx.session.selectedDate)
      .utc()
      .add(5, 'hour')
      .format('DD.MM.YYYY'),
    court: ctx.session.court,
  });

  await fs.appendFile(
    './log.log',
    `[${dayjs()
      .utc()
      .add(5, 'hour')
      .format('DD-MM-YYYY hh:mm:ss')}]: ${JSON.stringify(data)}\n`,
    () => {
      // console.log('file updated');
    },
  );

  if (!data) {
    await ctx.reply(
      'Произошла ошибка при запросе данных с сайта суда 😔\nПопробуй еще раз позже',
    );
    return;
  }

  if (!data.length) {
    await ctx.reply('По данному запросу ничего не найдено 😔');
    return;
  }

  let replyString = `*Данные суда на ${dayjs(ctx.session.selectedDate)
    .utc()
    .add(5, 'hour')
    .format('DD.MM.YYYY')}*\n\n`;

  data.forEach(
    ({
      caseNumber,
      time,
      judge = 'Нет данных',
      link,
      info,
      room = 'Нет данных',
    }) => {
      replyString +=
        `ФИО: ${getPersonName(info)}\n` +
        `Номер дела: [${caseNumber}](${link})\n` +
        `Время расcмотрения: ${time}\n` +
        `Комната: ${room}\n` +
        `Судья: ${judge}\n\n`;
    },
  );
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

    const currentConfig =
      court === 'Областной'
        ? config.regionalCourtParseConfig
        : config.districtCourtsParseConfig;
    const $ = cheerio.load(html, { decodeEntities: false });
    $(currentConfig.selector).each(async (i, elem) => {
      if ($(elem).find('td').length !== 1) {
        const children = $(elem).children();
        const orderNumber = children
          .eq(currentConfig.orderNumberCol)
          .text()
          .replace('.', '');
        const caseNumber = children.eq(currentConfig.caseNumberCol).text();
        const link = `${url}${children
          .eq(currentConfig.caseNumberCol)
          .find('a')
          .attr('href')}`;
        const time = children.eq(currentConfig.timeCol).text();
        const event = children.eq(currentConfig.eventCol).text();
        const room = children.eq(currentConfig.roomCol).text();
        const info = children
          .eq(currentConfig.infoCol)
          .text()
          .replace('ПРАВОНАРУШЕНИЕ: ', '');
        const judge = children.eq(currentConfig.judgeCol).text();

        if (!config.regExp.test(info)) {
          return;
        }

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

  return data;
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
      return 'https://zheleznodorozhny--svd.sudrf.ru/modules.php?name=sud_delo&srv_num=1';
    }
    case 'Кировский': {
      return 'https://kirovsky--svd.sudrf.ru/modules.php?name=sud_delo&srv_num=2';
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
    case 'Областной': {
      return 'https://oblsud--svd.sudrf.ru/modules.php?name=sud_delo&srv_num=1&name_op=hl';
    }
    default: {
      throw new Error('Invalid court name');
    }
  }
}

const TOKEN = ENV_BOT_TOKEN; // Get it from @BotFather
const WEBHOOK = '/endpoint';
const SECRET = ENV_BOT_SECRET; // A-Z, a-z, 0-9, _ and -
const ADMIN_UID = ENV_ADMIN_UID; // your user id, get it from https://t.me/username_to_id_bot

const WEEK_INTERVAL = 7 * 24 * 3600 * 1000;  // 1 周的毫秒数
const fraudDb = 'https://raw.githubusercontent.com/LloydAsp/nfd/main/data/fraud.db';
const notificationUrl = 'https://raw.githubusercontent.com/LloydAsp/nfd/main/data/notification.txt';
const startMsgUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/startMessage.md';

const enable_notification = true;

function apiUrl(methodName, params = null) {
  let query = '';
  if (params) {
    query = '?' + new URLSearchParams(params).toString();
  }
  return `https://api.telegram.org/bot${TOKEN}/${methodName}${query}`;
}

function requestTelegram(methodName, body, params = null) {
  return fetch(apiUrl(methodName, params), body)
    .then(r => r.json());
}

function makeReqBody(body) {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

function sendMessage(msg = {}) {
  return requestTelegram('sendMessage', makeReqBody(msg));
}

function copyMessage(msg = {}) {
  return requestTelegram('copyMessage', makeReqBody(msg));
}

function forwardMessage(msg) {
  return requestTelegram('forwardMessage', makeReqBody(msg));
}

addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname === WEBHOOK) {
    event.respondWith(handleWebhook(event));
  } else if (url.pathname === '/registerWebhook') {
    event.respondWith(registerWebhook(event, url, WEBHOOK, SECRET));
  } else if (url.pathname === '/unRegisterWebhook') {
    event.respondWith(unRegisterWebhook(event));
  } else {
    event.respondWith(new Response('No handler for this request'));
  }
});

// 处理 Webhook 请求
async function handleWebhook(event) {
  if (event.request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== SECRET) {
    return new Response('Unauthorized', { status: 403 });
  }

  const update = await event.request.json();
  event.waitUntil(onUpdate(update));

  return new Response('Ok');
}

// 处理每个更新
async function onUpdate(update) {
  if ('message' in update) {
    await onMessage(update.message);
  }
  if ('callback_query' in update) {
    await onCallbackQuery(update.callback_query);
  }
}

// 处理消息
async function onMessage(message) {
  if (message.text === '/start') {
    let startMsg = await fetch(startMsgUrl).then(r => r.text());
    // 获取用户的名字、姓氏和用户 ID
    let firstName = message.from.first_name || '未知用户';
    let lastName = message.from.last_name ? ` ${message.from.last_name}` : '';
    let userId = message.from.id;

    // 替换欢迎消息中的动态内容
    startMsg = startMsg.replace('{{username}}', firstName + lastName);
    startMsg = startMsg.replace('{{user_id}}', userId);

    // 创建包含按钮的回复
    let replyMarkup = {
      inline_keyboard: [
        [
          { text: '李小白博客', url: 'https://blog.lxb.icu' },  // 链接到李小白博客
          { text: '点击联系我', callback_data: 'startCommand' }   // 使用 callback_data 触发 /start
        ]
      ]
    };

    return sendMessage({
      chat_id: message.chat.id,
      text: startMsg,
      parse_mode: 'Markdown', // 使用 Markdown 解析消息
      reply_markup: replyMarkup // 添加按钮
    });
  }
  
  // 处理管理员指令
  if (message.chat.id.toString() === ADMIN_UID) {
    if (!message?.reply_to_message?.chat) {
      return sendMessage({
        chat_id: ADMIN_UID,
        text: '使用方法，回复转发的消息，并发送回复消息，或者`/block`、`/unblock`、`/checkblock`等指令'
      });
    }
    if (/^\/block$/.exec(message.text)) {
      return handleBlock(message);
    }
    if (/^\/unblock$/.exec(message.text)) {
      return handleUnBlock(message);
    }
    if (/^\/checkblock$/.exec(message.text)) {
      return checkBlock(message);
    }
    let guestChantId = await nfd.get('msg-map-' + message?.reply_to_message.message_id, { type: "json" });
    return copyMessage({
      chat_id: guestChantId,
      from_chat_id: message.chat.id,
      message_id: message.message_id,
    });
  }
  
  // 处理访客消息
  return handleGuestMessage(message);
}

// 处理点击按钮事件
async function onCallbackQuery(callbackQuery) {
  if (callbackQuery.data === 'startCommand') {
    const chatId = callbackQuery.from.id;

    // 回复用户，触发 /start 命令
    let startMsg = await fetch(startMsgUrl).then(r => r.text());
    let firstName = callbackQuery.from.first_name || '未知用户';
    let lastName = callbackQuery.from.last_name ? ` ${callbackQuery.from.last_name}` : '';
    let userId = callbackQuery.from.id;

    // 替换欢迎消息中的动态内容
    startMsg = startMsg.replace('{{username}}', firstName + lastName);
    startMsg = startMsg.replace('{{user_id}}', userId);

    return sendMessage({
      chat_id: chatId,
      text: startMsg,
      parse_mode: 'Markdown'
    });
  }
}

// 处理访客消息
async function handleGuestMessage(message) {
  let chatId = message.chat.id;
  let isblocked = await nfd.get('isblocked-' + chatId, { type: "json" });
  
  if (isblocked) {
    return sendMessage({
      chat_id: chatId,
      text: 'You are blocked'
    });
  }

  let forwardReq = await forwardMessage({
    chat_id: ADMIN_UID,
    from_chat_id: message.chat.id,
    message_id: message.message_id
  });

  if (forwardReq.ok) {
    await nfd.put('msg-map-' + forwardReq.result.message_id, chatId);
  }

  return handleNotify(message);
}

// 处理通知
async function handleNotify(message) {
  let chatId = message.chat.id;
  if (await isFraud(chatId)) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `检测到骗子，UID${chatId}`
    });
  }
  if (enable_notification) {
    let lastMsgTime = await nfd.get('lastmsg-' + chatId, { type: "json" });
    if (!lastMsgTime || Date.now() - lastMsgTime > NOTIFY_INTERVAL) {
      await nfd.put('lastmsg-' + chatId, Date.now());
      return sendMessage({
        chat_id: ADMIN_UID,
        text: await fetch(notificationUrl).then(r => r.text())
      });
    }
  }
}

// 屏蔽用户
async function handleBlock(message) {
  let guestChantId = await nfd.get('msg-map-' + message.reply_to_message.message_id, { type: "json" });
  if (guestChantId === ADMIN_UID) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: '不能屏蔽自己'
    });
  }
  await nfd.put('isblocked-' + guestChantId, true);
  return sendMessage({
    chat_id: ADMIN_UID,
    text: `UID:${guestChantId}屏蔽成功`,
  });
}

// 解除屏蔽
async function handleUnBlock(message) {
  let guestChantId = await nfd.get('msg-map-' + message.reply_to_message.message_id, { type: "json" });
  await nfd.put('isblocked-' + guestChantId, false);
  return sendMessage({
    chat_id: ADMIN_UID,
    text: `UID:${guestChantId}解除屏蔽成功`,
  });
}

// 检查用户是否被屏蔽
async function checkBlock(message) {
  let guestChantId = await nfd.get('msg-map-' + message.reply_to_message.message_id, { type: "json" });
  let blocked = await nfd.get('isblocked-' + guestChantId, { type: "json" });

  return sendMessage({
    chat_id: ADMIN_UID,
    text: `UID:${guestChantId}` + (blocked ? '被屏蔽' : '没有被屏蔽')
  });
}

// 设置 Webhook
async function registerWebhook(event, requestUrl, suffix, secret) {
  const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`;
  const r = await (await fetch(apiUrl('setWebhook', { url: webhookUrl, secret_token: secret }))).json();
  return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2));
}

// 取消 Webhook
async function unRegisterWebhook(event) {
  const r = await (await fetch(apiUrl('setWebhook', { url: '' }))).json();
  return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2));
}

// 检查是否为骗子
async function isFraud(id) {
  id = id.toString();
  let db = await fetch(fraudDb).then(r => r.text());
  let arr = db.split('\n').filter(v => v);
  let flag = arr.filter(v => v === id).length !== 0;
  return flag;
}

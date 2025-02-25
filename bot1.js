const TOKEN = ENV_BOT_TOKEN // 从 @BotFather 获取的令牌
const WEBHOOK = '/endpoint'
const SECRET = ENV_BOT_SECRET // A-Z, a-z, 0-9, _ 和 -
const ADMIN_UID = ENV_ADMIN_UID // 你的用户 ID，可以从 https://t.me/username_to_id_bot 获取

const NOTIFY_INTERVAL = 7 * 24 * 3600 * 1000;
const fraudDb = 'https://raw.githubusercontent.com/LloydAsp/nfd/main/data/fraud.db';
const notificationUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/notification.txt'
const startMsgUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/startMessage.md';

const enable_notification = false

function apiUrl(methodName, params = null) {
  let query = ''
  if (params) {
    query = '?' + new URLSearchParams(params).toString()
  }
  return `https://api.telegram.org/bot${TOKEN}/${methodName}${query}`
}

function requestTelegram(methodName, body, params = null) {
  return fetch(apiUrl(methodName, params), body)
    .then(r => r.json())
}

function makeReqBody(body) {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  }
}

function sendMessage(msg = {}) {
  return requestTelegram('sendMessage', makeReqBody(msg))
}

function copyMessage(msg = {}) {
  return requestTelegram('copyMessage', makeReqBody(msg))
}

function forwardMessage(msg) {
  return requestTelegram('forwardMessage', makeReqBody(msg))
}

function deleteMessage(msg = {}) {
  return requestTelegram('deleteMessage', makeReqBody(msg))
}

addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (url.pathname === WEBHOOK) {
    event.respondWith(handleWebhook(event))
  } else if (url.pathname === '/registerWebhook') {
    event.respondWith(registerWebhook(event, url, WEBHOOK, SECRET))
  } else if (url.pathname === '/unRegisterWebhook') {
    event.respondWith(unRegisterWebhook(event))
  } else {
    event.respondWith(new Response('No handler for this request'))
  }
})

async function handleWebhook(event) {
  if (event.request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== SECRET) {
    return new Response('Unauthorized', { status: 403 })
  }

  const update = await event.request.json()
  event.waitUntil(onUpdate(update))

  return new Response('Ok')
}

async function onUpdate(update) {
  if ('message' in update) {
    await onMessage(update.message)
  }
}

async function onMessage(message) {
  if (message.text === '/start') {
    const userId = message.from.id;
    let username = message.from.username || (message.from.first_name && message.from.last_name
      ? message.from.last_name + " " + message.from.first_name
      : message.from.first_name) || "未知用户";

    let startMsg = await fetch(startMsgUrl).then(r => r.text());
    startMsg = startMsg.replace('{{username}}', username).replace('{{user_id}}', userId);

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '李小白博客',
            url: 'https://blog.lxb.icu'
          }
        ]
      ]
    };

    return sendMessage({
      chat_id: message.chat.id,
      text: startMsg,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  if (message.chat.id.toString() === ADMIN_UID) {
    if (/^\/blocklist$/.test(message.text)) {
      return handleBlockList(message);
    }
    if (!message?.reply_to_message?.chat) {
      return sendMessage({
        chat_id: ADMIN_UID,
        text: `
使用方法：

1. 🈲 屏蔽用户：
   - 回复某个用户的消息，发送 \`/block\`

2. ✅ 解除屏蔽：
   - 回复某个已屏蔽用户的消息，发送 \`/unblock\`

3. 🔍 检查屏蔽状态：
   - 回复某个用户的消息，发送 \`/checkblock\`

4. 📜 查看屏蔽列表：
   - 发送 \`/blocklist\` 查看所有被屏蔽用户

5. 💬 回复消息：
   - 回复机器人消息可直接发送回复`,
        parse_mode: 'Markdown'
      })
    }
    if (/^\/block$/.exec(message.text)) {
      return handleBlock(message)
    }
    if (/^\/unblock$/.exec(message.text)) {
      return handleUnBlock(message)
    }
    if (/^\/checkblock$/.exec(message.text)) {
      return checkBlock(message)
    }
    if (/^\/blocklist$/.test(message.text)) {
      return handleBlockList(message)
    }
    let guestChantId = await lBot.get('msg-map-' + message?.reply_to_message.message_id,
      { type: "json" })
    return copyMessage({
      chat_id: guestChantId,
      from_chat_id: message.chat.id,
      message_id: message.message_id,
    })
  }

  return handleGuestMessage(message);
}

async function handleGuestMessage(message) {
  let chatId = message.chat.id;
  let isBlocked = await lBot.get('isblocked-' + chatId, { type: "json" });

  if (isBlocked) {
    return sendMessage({
      chat_id: chatId,
      text: '隔断天涯路，言辞难再通',
    });
  }

  const sentMessage = await sendMessage({
    chat_id: chatId,
    text: '✅消息已送达，看到后会尽快回复你的',
  });

  setTimeout(async () => {
    await deleteMessage({
      chat_id: chatId,
      message_id: sentMessage.result.message_id,
    });
  }, 360);

  let forwardReq = await forwardMessage({
    chat_id: ADMIN_UID,
    from_chat_id: message.chat.id,
    message_id: message.message_id,
  });

  if (forwardReq.ok) {
    await lBot.put('msg-map-' + forwardReq.result.message_id, chatId);
  }

  return handleNotify(message);
}

async function handleNotify(message) {
  let chatId = message.chat.id;
  if (await isFraud(chatId)) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `检测到骗子，UID${chatId}`
    })
  }
  if (enable_notification) {
    let lastMsgTime = await lBot.get('lastmsg-' + chatId, { type: "json" })
    if (!lastMsgTime || Date.now() - lastMsgTime > NOTIFY_INTERVAL) {
      await lBot.put('lastmsg-' + chatId, Date.now())
      return sendMessage({
        chat_id: ADMIN_UID,
        text: await fetch(notificationUrl).then(r => r.text())
      })
    }
  }
}

async function handleBlock(message) {
  let guestChantId = await lBot.get('msg-map-' + message.reply_to_message.message_id,
    { type: "json" })
  if (guestChantId === ADMIN_UID) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: '不能屏蔽自己'
    })
  }
  await lBot.put('isblocked-' + guestChantId, true)

  return sendMessage({
    chat_id: ADMIN_UID,
    text: `UID:${guestChantId}屏蔽成功`,
  })
}

async function handleUnBlock(message) {
  let guestChantId = await lBot.get('msg-map-' + message.reply_to_message.message_id,
    { type: "json" })

  await lBot.put('isblocked-' + guestChantId, false)

  return sendMessage({
    chat_id: ADMIN_UID,
    text: `UID:${guestChantId}解除屏蔽成功`,
  })
}

async function checkBlock(message) {
  let guestChantId = await lBot.get('msg-map-' + message.reply_to_message.message_id,
    { type: "json" })
  let blocked = await lBot.get('isblocked-' + guestChantId, { type: "json" })

  return sendMessage({
    chat_id: ADMIN_UID,
    text: `UID:${guestChantId}` + (blocked ? '被屏蔽' : '没有被屏蔽')
  })
}

async function handleBlockList(message) {
  let blockedUsers = [];
  let cursor = null;

  do {
    const list = await lBot.list({ prefix: 'isblocked-', cursor });
    for (const key of list.keys) {
      const isBlocked = await lBot.get(key.name, { type: "json" });
      if (isBlocked) {
        const uid = key.name.replace('isblocked-', '');
        blockedUsers.push(uid);
      }
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);

  let responseText = '🛑 被屏蔽用户列表：\n';
  if (blockedUsers.length > 0) {
    responseText += blockedUsers.join('\n');
  } else {
    responseText += '当前没有屏蔽用户';
  }

  return sendMessage({
    chat_id: ADMIN_UID,
    text: responseText,
    parse_mode: 'Markdown'
  });
}

async function registerWebhook(event, requestUrl, suffix, secret) {
  const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`
  const r = await (await fetch(apiUrl('setWebhook', { url: webhookUrl, secret_token: secret }))).json()
  return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2))
}

async function unRegisterWebhook(event) {
  const r = await (await fetch(apiUrl('setWebhook', { url: '' }))).json()
  return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2))
}

async function isFraud(id) {
  id = id.toString()
  let db = await fetch(fraudDb).then(r => r.text())
  let arr = db.split('\n').filter(v => v)
  return arr.filter(v => v === id).length !== 0
}

const TOKEN = ENV_BOT_TOKEN;
const WEBHOOK = '/endpoint';
const SECRET = ENV_BOT_SECRET;
const ADMIN_UID = ENV_ADMIN_UID;
const NOTIFY_INTERVAL = 7 * 24 * 3600 * 1000;
const fraudDb = 'https://raw.githubusercontent.com/LloydAsp/nfd/main/data/fraud.db'; 
const notificationUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/notification.txt'; 
const startMsgUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/startMessage.md'; 
const userDataTemplateUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/userdata.md'; 
const helpTemplateUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/helpMessage.md'; 
const blockListTemplateUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/blockListTemplate.md'; 
const fraudListTemplateUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/fraudListTemplate.md'; 
const statusBgImage = 'https://img.siyouyun.eu.org/file/1740569053174_IMG_2363.png'; 
const helpBgImage = 'https://img.siyouyun.eu.org/file/1740571550415_IMG_2365.png'; 
const blockBgImage = 'https://img.siyouyun.eu.org/file/1740568575434_IMG_2364.png'; 
const unblockBgImage = 'https://img.siyouyun.eu.org/file/1740557604080_p0 2.png'; 
const addFraudBgImage = 'https://img.siyouyun.eu.org/file/1740548062053_p0.png'; 
const removeFraudBgImage = 'https://img.siyouyun.eu.org/file/1740666584421_IMG_2398.png'; 
const checkStatusBgImage = 'https://img.siyouyun.eu.org/file/1740666581688_IMG_2394.png'; 
const finalTextBgImage = 'https://img.siyouyun.eu.org/file/1740666584991_IMG_2397.png'; 
const handleUserInfoBgImage = 'https://img.siyouyun.eu.org/file/1740666583692_IMG_2395.png'; 
const handleBlockListBgImage = 'https://img.siyouyun.eu.org/file/1740666589433_IMG_2396.png'; 
const LOCAL_FRAUD_PREFIX = 'fraud-local-';
const enable_notification = false;
function apiUrl(methodName, params = null) {
  return `https://api.telegram.org/bot${TOKEN}/${methodName}${params ? '?' + new URLSearchParams(params) : ''}`;
}
function editMessageCaption(msg) {
  return requestTelegram('editMessageCaption', makeReqBody(msg));
}
function editMessageText(msg) {
  return requestTelegram('editMessageText', makeReqBody(msg));
}
function editMessageReplyMarkup(msg) {
  return requestTelegram('editMessageReplyMarkup', makeReqBody(msg));
}
function requestTelegram(methodName, body, params = null) {
  return fetch(apiUrl(methodName, params), body).then(r => r.json());
}
function makeReqBody(body) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };
}
function sendMessage(msg = {}) {
  return requestTelegram('sendMessage', makeReqBody(msg));
}
function sendPhoto(msg = {}) {
  return requestTelegram('sendPhoto', makeReqBody(msg));
}
function copyMessage(msg = {}) {
  return requestTelegram('copyMessage', makeReqBody(msg));
}
function forwardMessage(msg) {
  return requestTelegram('forwardMessage', makeReqBody(msg));
}
function deleteMessage(msg = {}) {
  return requestTelegram('deleteMessage', makeReqBody(msg));
}
function getChat(chat_id) {
  return requestTelegram('getChat', null, { chat_id });
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
async function handleWebhook(event) {
  if (event.request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== SECRET) {
    return new Response('Unauthorized', { status: 403 });
  }
  const update = await event.request.json();
  event.waitUntil(onUpdate(update));
  return new Response('Ok');
}
async function onUpdate(update) {
  if ('message' in update) {
    await onMessage(update.message);
  } else if ('callback_query' in update) {
    await onCallbackQuery(update.callback_query);
  }
}
/******************** 回调处理模块 ********************/
async function onCallbackQuery(callbackQuery) {
  if (callbackQuery.from.id.toString() !== ADMIN_UID) {
    return requestTelegram('answerCallbackQuery', makeReqBody({
      callback_query_id: callbackQuery.id,
      text: "⚠️ 权限不足"
    }));
  }
  const [action, userId] = callbackQuery.data.split(':');
  const message = callbackQuery.message;
  try {
    switch(action) {
      case 'confirm_block':
        await performBlock(userId);
        await editMessageCaption({
          chat_id: message.chat.id,
          message_id: message.message_id,
          caption: `✅ 已屏蔽用户 \`${userId}\`\n操作时间：${formatAdminTime()}`,
          parse_mode: 'Markdown'
        });
        break;
      case 'view_profile':
        await handleUserInfo(message, userId);
        break;
      case 'confirm_unblock':
        await lBot.delete('isblocked-' + userId);
        await editMessageCaption({
          chat_id: message.chat.id,
          message_id: message.message_id,
          caption: `✅ 已解除屏蔽用户 \`${userId}\``,
          parse_mode: 'Markdown'
        });
        break;
      case 'cancel_block':
      case 'cancel_unblock':
      case 'cancel_add_fraud':
      case 'cancel_remove_fraud':
         await editMessageCaption({
          chat_id: message.chat.id,
          message_id: message.message_id,
          caption: "❌ 操作已取消",
          reply_markup: { inline_keyboard: [] } 
        });
        break;
        case 'confirm_add_fraud':
          await performAddFraud(userId);
          await editMessageCaption({
            chat_id: message.chat.id,
            message_id: message.message_id,
            caption: `✅ 已添加欺诈用户 ${userId}\n操作时间：${formatAdminTime()}`,
            parse_mode: 'Markdown'
          });
          break;
        case 'confirm_remove_fraud':
          await lBot.delete(LOCAL_FRAUD_PREFIX + userId);
          await editMessageCaption({
            chat_id: message.chat.id,
            message_id: message.message_id,
            caption: `✅ 已移除欺诈用户 ${userId}`,
            parse_mode: 'Markdown'
          });
          break;
    }
  } catch (error) {
    await editMessageCaption({
      chat_id: message.chat.id,
      message_id: message.message_id,
      caption: `❌ 操作失败：${error.message}`
    });
  }
  return requestTelegram('answerCallbackQuery', makeReqBody({
    callback_query_id: callbackQuery.id
  }));
}
async function performBlock(userId) {
  const existing = await lBot.get(`isblocked-${userId}`);
  if (existing) {
    throw new Error('该用户已被屏蔽');
  }
  const targetUser = await getChat(userId);
  const operatorInfo = await getChat(ADMIN_UID);
  const storeData = {
    target: {
      id: userId,
      name: [
        targetUser.result.last_name, 
        targetUser.result.first_name
      ].filter(Boolean).join(' ') || '未知',
      username: targetUser.result.username || '无'
    },
    operator: {
      name: [
        operatorInfo.result.last_name, 
        operatorInfo.result.first_name
      ].filter(Boolean).join(' ') || '系统管理员',
      username: operatorInfo.result.username || '无'
    },
    timestamp: Date.now()
  };
  await lBot.put(`isblocked-${userId}`, JSON.stringify(storeData));
}
async function handleUnBlock(message) {
  const guestChatId = await lBot.get('msg-map-' + message.reply_to_message.message_id, { type: "json" });
  return sendPhoto({
    chat_id: ADMIN_UID,
    photo: unblockBgImage,
    caption: `⚠️ *解除屏蔽确认*\n\n即将解除用户：\`${guestChatId}\`\n\n请确认操作：`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ 确认解除", callback_data: `confirm_unblock:${guestChatId}` },
          { text: "❌ 取消", callback_data: `cancel_unblock:${guestChatId}` }
        ]
      ]
    }
  });
}
async function editMessageReplyMarkup(chatId, messageId) {
  return requestTelegram('editMessageReplyMarkup', makeReqBody({
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] }
  }));
}
async function editMessageText(chatId, messageId, text) {
  return requestTelegram('editMessageText', makeReqBody({
    chat_id: chatId,
    message_id: messageId,
    text
  }));
}
async function onMessage(message) {
  if (message.text && message.text.startsWith('/') && message.text !== '/start') {
    if (message.chat.id.toString() !== ADMIN_UID) {
      const { result } = await sendMessage({
        chat_id: message.chat.id,
        text: '⛔ 该指令仅主人可用'
      });
      await new Promise(resolve => setTimeout(resolve, 480)); 
      await deleteMessage({
        chat_id: result.chat.id,
        message_id: result.message_id
      });
      return; 
    }
  }
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
    if (/^\/fraud(?:\s+\d+)?$/.test(message.text)) {
      if (message.reply_to_message) { 
        return handleFraudByReply(message);
      }
      const userId = message.text.split(' ')[1];
      if (userId) {
        return handleFraudByUserId(message, userId);
      }
      return;
    }
    
    if (/^\/unfraud(?:\s+\d+)?$/.test(message.text)) {
      if (message.reply_to_message) { 
        return handleUnfraudByReply(message);
      }
      const userId = message.text.split(' ')[1];
      if (userId) {
        return handleUnfraudByUserId(message, userId);
      }
      return;
    }
    if (/^\/userinfo\s+\d+$/.test(message.text)) {
      const userId = message.text.split(' ')[1];
      return handleUserInfo(message, userId);
    }
    if (/^\/unblockid\s+\d+$/.test(message.text)) {
      const userId = message.text.split(' ')[1];
      return handleUnBlockById(message, userId);
    }
    if (/^\/localfraudlist$/.test(message.text)) {
      return handleLocalFraudList(message);
    }
    if (message.text === '/help') {
      return handleHelpCommand(message);
    }
    if (message.text === '/status') {
      return handleStatusCommand(message);
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
    if (/^\/blocklist$/.test(message.text)) {
      return handleBlockList(message);
    }
    let guestChatId = await lBot.get('msg-map-' + message?.reply_to_message.message_id,
      { type: "json" });
    return copyMessage({
      chat_id: guestChatId,
      from_chat_id: message.chat.id,
      message_id: message.message_id,
    });
  }
  return handleGuestMessage(message);
}
async function getLocalFraudCount() {
  let count = 0;
  let cursor = null;
  do {
    const list = await lBot.list({ prefix: LOCAL_FRAUD_PREFIX, cursor });
    count += list.keys.length;
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);
  return count;
}
async function handleHelpCommand(message) {
  try {
    const [template, blockedCount, fraudCount] = await Promise.all([
      fetch(helpTemplateUrl).then(r => r.text()),
      getLocalBlockedCount(),
      getLocalFraudCount()
    ]);
    const finalText = template
      .replace('{{botName}}', '李小白')
      .replace('{{blockedCount}}', blockedCount)
      .replace('{{fraudCount}}', fraudCount)
      .replace('{{updateTime}}', formatAdminTime());
    return sendPhoto({
      chat_id: ADMIN_UID,
      photo: helpBgImage,
      caption: finalText,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
  } catch (error) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `⚠️ 帮助菜单加载失败：${error.message}`
    });
  }
}
async function handleStatusCommand(message) {
  try {
    const [blockedCount, fraudCount] = await Promise.all([
      getLocalBlockedCount(),
      getLocalFraudCount()
    ]);
    const statusText = `🤖 *机器人状态监控*\n\n🛡️ 本地屏蔽访客：${blockedCount} 人\n🚨 欺诈访客记录：${fraudCount} 人\n🔄 最后更新：${formatAdminTime()}`;
    return sendPhoto({
      chat_id: ADMIN_UID,
      photo: statusBgImage,
      caption: statusText,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `⚠️ 状态获取失败：${error.message}`
    });
  }
}
async function getLocalBlockedCount() {
  let count = 0;
  let cursor = null;
  do {
    const list = await lBot.list({ prefix: 'isblocked-', cursor });
    count += list.keys.length;
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);
  return count;
}
async function loadFraudDataFromStorage() {
  const users = [];
  let cursor = null;
  do {
    const list = await lBot.list({ prefix: LOCAL_FRAUD_PREFIX, cursor });
    for (const key of list.keys) {
      const rawData = await lBot.get(key.name, { type: 'json' });
      if (rawData) {
        users.push({
          id: key.name.replace(LOCAL_FRAUD_PREFIX, ''),
          ...rawData
        });
      }
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);
  return users;
}
function formatAdminTime(date = new Date()) {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-');
}
async function isLocalFraud(id) {
  const record = await lBot.get(LOCAL_FRAUD_PREFIX + id, { type: 'json' });
  return !!record;
}
async function checkFraud(id) {
  const remoteCheck = await isFraud(id);
  const localCheck = await isLocalFraud(id);
  return remoteCheck || localCheck;
}
async function handleLocalFraudList(message) {
  try {
    const [template, fraudList] = await Promise.all([
      fetch(fraudListTemplateUrl).then(r => r.text()),
      loadFraudDataFromStorage()
    ]);
    const keyboard = [];
    const usersSection = fraudList.map((user, index) => {
      const operatorInfo = user.operator.username 
        ? `${user.operator.name} (@${user.operator.username})`
        : user.operator.name;
      const userInfoButton = {
        text: "👤资料",
        callback_data: `view_profile:${user.target.id}`
      };
      const removeFraudButton = {
        text: `✅解除 ${user.target.id}`,
        callback_data: `confirm_remove_fraud:${user.target.id}`
      };
      keyboard.push([
        userInfoButton,
        removeFraudButton
      ]);
      return `🔸 用户 ${index + 1}\n` +
        `├─🚫 用户ID：\`${user.target.id}\`\n` +
        `├─📛 全称：${user.target.name}\n` +
        `├─📧 用户名：${user.target.username === '无' ? '（未设置）' : '@'+user.target.username}\n` +
        `├─🛡️ 操作人：${operatorInfo}\n` +
        `└─⏰ 时间：${formatAdminTime(new Date(user.timestamp))}`;
    }).join('\n\n');
    const finalText = template
      .replace('{{count}}', fraudList.length)
      .replace('{{users}}', fraudList.length ? usersSection : '当前无欺诈访客记录')
      .replace('{{updateTime}}', formatAdminTime());
    return sendPhoto({
      chat_id: ADMIN_UID,
      photo: finalTextBgImage,
      caption: finalText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  } catch (error) {
    console.error('欺诈列表处理失败:', error);
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `⚠️ 欺诈列表加载失败：${error.message}`
    });
  }
}
async function loadBlockedUsersData() {
  const users = [];
  let cursor = null;
  do {
    const list = await lBot.list({ prefix: 'isblocked-', cursor });
    for (const key of list.keys) {
      const rawData = await lBot.get(key.name, { type: 'json' });
      if (rawData) {
        users.push({
          id: key.name.replace('isblocked-', ''),
          ...rawData
        });
      }
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);
  return users;
}
async function handleFraudByReply(message) {
  const guestChatId = await lBot.get('msg-map-' + message.reply_to_message.message_id, { type: "json" });
  const confirmKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ 添加", callback_data: `confirm_add_fraud:${guestChatId}`},
        { text: "👤 资料", callback_data: `view_profile:${guestChatId}`},
        { text: "❌ 取消", callback_data: `cancel_add_fraud:${guestChatId}`}
      ]
    ]
  };
  return sendPhoto({
    chat_id: ADMIN_UID,
    photo: addFraudBgImage,
    caption: `⚠️ 添加欺诈用户确认\n\n即将添加用户：${guestChatId}`,
    parse_mode: 'Markdown',
    reply_markup: confirmKeyboard
  });
}
async function performAddFraud(userId) {
  const targetUser = await getChat(userId);
  const operatorInfo = await getChat(ADMIN_UID);
  const storeData = {
    target: {
      id: userId,
      name: [targetUser.result.last_name, targetUser.result.first_name].filter(Boolean).join(' ') || '未知',
      username: targetUser.result.username || '无'
    },
    operator: {
      name: [operatorInfo.result.last_name, operatorInfo.result.first_name].filter(Boolean).join(' ') || '系统管理员',
      username: operatorInfo.result.username || '无'
    },
    timestamp: Date.now()
  };
  await lBot.put(LOCAL_FRAUD_PREFIX + userId, JSON.stringify(storeData));
}
async function handleFraudByUserId(message, userId) {
  try {
    const userCheck = await getChat(userId);
    if (!userCheck.ok) {
      return sendMessage({
        chat_id: ADMIN_UID,
        text: `❌ 访客不存在：${userCheck.description}`
      });
    }
    const existing = await lBot.get(LOCAL_FRAUD_PREFIX + userId, { type: 'json' });
    if (existing) {
      return sendMessage({
        chat_id: ADMIN_UID,
        text: `⚠️ 访客 ${userId} 已在欺诈名单中`
      });
    }
    const confirmKeyboard = {
      inline_keyboard: [
        [
          { text: "✅ 添加", callback_data: `confirm_add_fraud:${userId}`},
          { text: "👤 资料", callback_data: `view_profile:${userId}`},
          { text: "❌ 取消", callback_data: `cancel_add_fraud:${userId}`}
        ]
      ]
    };
    return sendPhoto({
      chat_id: ADMIN_UID,
      photo: addFraudBgImage,
      caption: `⚠️ 添加欺诈用户确认（ID模式）\n\n用户ID：${userId}`,
      parse_mode: 'Markdown',
      reply_markup: confirmKeyboard
    });
  } catch (error) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `❌ 操作失败：${error.message}`
    });
  }
}
async function handleUnfraudByReply(message) {
  const guestChatId = await lBot.get('msg-map-' + message.reply_to_message.message_id, { type: "json" });
  const existing = await lBot.get(LOCAL_FRAUD_PREFIX + guestChatId, { type: 'json' });
  if (!existing) {
    return sendPhoto({
      chat_id: ADMIN_UID,
      photo: removeFraudBgImage, 
      caption: `❌ 访客 \`${guestChatId}\` 不在欺诈名单中`,
      parse_mode: 'Markdown'
    });
  }
  const confirmKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ 确认移除", callback_data: `confirm_remove_fraud:${guestChatId}`},
        { text: "❌ 取消", callback_data: `cancel_unblock:${guestChatId}`}
      ]
    ]
  };
  return sendPhoto({
    chat_id: ADMIN_UID,
    photo: removeFraudBgImage,
    caption: `⚠️ 移除欺诈用户确认\n\n用户ID：${guestChatId}`,
    parse_mode: 'Markdown',
    reply_markup: confirmKeyboard
  });
}
async function handleUnfraudByUserId(message, userId) {
  try {
    const existing = await lBot.get(LOCAL_FRAUD_PREFIX + userId, { type: 'json' });
    if (!existing) {
      return sendMessage({
        photo: removeFraudBgImage,
        caption: `❌ 访客 \`${guestChatId}\` 不在欺诈名单中`,
        parse_mode: 'Markdown'
      });
    }
    const confirmKeyboard = {
      inline_keyboard: [
        [
          { text: "✅ 确认移除", callback_data: `confirm_remove_fraud:${userId}`},
          { text: "❌ 取消", callback_data: `cancel_unblock:${userId}`}
        ]
      ]
    };
    return sendPhoto({
      chat_id: ADMIN_UID,
      photo: removeFraudBgImage,
      caption: `⚠️ 移除欺诈用户确认（ID模式）\n\n用户ID：${userId}`,
      parse_mode: 'Markdown',
      reply_markup: confirmKeyboard
    });
  } catch (error) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `❌ 操作失败：${error.message}`
    });
  }
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
  }, 460);
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
  const isFraudUser = await checkFraud(chatId);
  if (isFraudUser) {
    let fullName = '';
    if (message.from.first_name || message.from.last_name) {
      fullName = [message.from.first_name, message.from.last_name]
        .filter(Boolean)
        .join(' ');
    } else {
      fullName = '无';
    }
    const reportText = `📛 欺诈访客消息报警\n\n` +
      `用户ID：\`${chatId}\`\n` +
      `用户名：@${message.from.username || '无'}\n` +
      `姓名：${fullName}\n` +
      `消息内容：\n\`\`\`\n${message.text || '（非文本消息）'}\n\`\`\``;
    await sendMessage({
      chat_id: ADMIN_UID,
      text: reportText,
      parse_mode: 'Markdown'
    });
  }
  if (enable_notification) {
    let lastMsgTime = await lBot.get('lastmsg-' + chatId, { type: "json" });
    if (!lastMsgTime || Date.now() - lastMsgTime > NOTIFY_INTERVAL) {
      await lBot.put('lastmsg-' + chatId, Date.now());
      return sendMessage({
        chat_id: ADMIN_UID,
        text: await fetch(notificationUrl).then(r => r.text())
      });
    }
  }
}
async function handleUserInfo(message, userId) {
  try {
    const chatRes = await getChat(userId);
    if (!chatRes.ok) {
      return sendMessage({
        chat_id: ADMIN_UID,
        text: `❌ 获取用户信息失败：${chatRes.description || '未知错误'}`
      });
    }
    const template = await fetch(userDataTemplateUrl).then(r => r.text());
    const user = chatRes.result;
    const filledTemplate = template
      .replace('{{userid}}', user.id)
      .replace('{{fullname}}', [user.last_name, user.first_name].filter(n => n && n.trim()).join(' ') || '未设置')
      .replace('{{username}}', user.username ? '@' + user.username : '无')
      .replace('{{isbot}}', user.is_bot ? '是 🤖' : '否 👤')
      .replace('{{lang}}', user.language_code || '未知')
      .replace('{{status}}', '🔍 活跃度分析需高级权限');
    return sendPhoto({
      chat_id: ADMIN_UID,
      photo: handleUserInfoBgImage,
      caption: filledTemplate,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
  } catch (error) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `⚠️ 查询出错：${error.message}`
    });
  }
}
async function handleBlock(message) {
  let guestChatId = await lBot.get('msg-map-' + message.reply_to_message.message_id, { type: "json" });
  const existingBlock = await lBot.get('isblocked-' + guestChatId);
  if (existingBlock) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `⚠️ 用户 ${guestChatId} 已在屏蔽名单中`
    });
  }
  if (guestChatId === ADMIN_UID.toString()) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: '❌ 不能屏蔽自己'
    });
  }
  const confirmKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ 确认", callback_data: `confirm_block:${guestChatId}` },
        { text: "👤 资料", callback_data: `view_profile:${guestChatId}` },
        { text: "❌ 取消", callback_data: `cancel_block:${guestChatId}` }
      ]
    ]
  };
  return sendPhoto({
    chat_id: ADMIN_UID,
    photo: blockBgImage,
    caption: `⚠️ *屏蔽确认*\n\n即将屏蔽用户：\`${guestChatId}\`\n\n请确认操作：`,
    parse_mode: 'Markdown',
    reply_markup: confirmKeyboard
  });
} 
async function handleUnBlock(message) {
  let guestChatId = await lBot.get('msg-map-' + message.reply_to_message.message_id, { type: "json" });
  const confirmKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ 确认解除", callback_data: `confirm_unblock:${guestChatId}` },
        { text: "❌ 取消", callback_data: `cancel_unblock:${guestChatId}` }
      ]
    ]
  };
  return sendPhoto({
    chat_id: ADMIN_UID,
    photo: unblockBgImage,
    caption: `⚠️ *解除屏蔽确认*\n\n即将解除用户：\`${guestChatId}\`\n\n请确认操作：`,
    parse_mode: 'Markdown',
    reply_markup: confirmKeyboard
  });
}
async function checkBlock(message) {
  let guestChatId = await lBot.get('msg-map-' + message.reply_to_message.message_id,
    { type: "json" });
  const blockedData = await lBot.get('isblocked-' + guestChatId, { type: "json" });
  if (blockedData) {
    let infoText;
    if (typeof blockedData === 'object') {
      const target = blockedData.target || {};
      const operator = blockedData.operator || {};
      const timestamp = new Date(blockedData.timestamp || Date.now());
      infoText = 
        `🔒 *用户屏蔽状态*\n\n` +
        `▫️ 用户ID：\`${target.id || '未知'}\`\n` +
        `▫️ 用户全名：${target.name || '未设置'}\n` + 
        `▫️ 用户账号：${target.username ? '@'+target.username : '未设置'}\n\n` +
        `🛡️ *操作信息*\n` +
        `▫️ 操作者：${operator.name || '系统操作'}\n` +
        `▫️ 操作账号：${operator.username ? '@'+operator.username : '未记录'}\n` +
        `▫️ 屏蔽时间：${formatAdminTime(timestamp)}`;
    } else {
      infoText = '⚠️ 旧格式数据，请重新屏蔽一次以升级';
    }
    return sendPhoto({
      chat_id: ADMIN_UID,
      photo: checkStatusBgImage, 
      caption: infoText,
      parse_mode: 'Markdown'
    });
  }
  return sendPhoto({
    chat_id: ADMIN_UID,
    photo: checkStatusBgImage,
    caption: `🔓 用户 \`${guestChatId}\` 未在屏蔽列表中`,
    parse_mode: 'Markdown'
  });
}
async function handleUnBlockById(message, userId) {
  try {
    if (userId === ADMIN_UID) {
      return sendMessage({
        chat_id: ADMIN_UID,
        text: '❌ 不能解除屏蔽自己'
      });
    }
    const chatRes = await getChat(userId);
    if (!chatRes.ok) {
      return sendMessage({
        chat_id: ADMIN_UID,
        text: `❌ 用户不存在：${chatRes.description || '未知错误'}`
      });
    }
    await lBot.delete('isblocked-' + userId);
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `✅ 已解除屏蔽该访客：${userId}`,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `⚠️ 解除屏蔽失败：${error.message}`
    });
  }
}
async function handleBlockList(message) {
  try {
    const [template, blockedUsers] = await Promise.all([
      fetch(blockListTemplateUrl).then(r => r.text()),
      loadBlockedUsersData()
    ]);
    const keyboard = [];
    const usersSection = blockedUsers.map((user, index) => {
      const operatorInfo = user.operator.username 
        ? `${user.operator.name} (@${user.operator.username})`
        : user.operator.name;
      const userInfoButton = {
        text: "👤资料",
        callback_data: `view_profile:${user.target.id}`
      };
      const unblockButton = {
        text: `✅解除 ${user.target.id}`,
        callback_data: `confirm_unblock:${user.target.id}`
      };
      keyboard.push([
        userInfoButton,
        unblockButton
      ]);
      return `🔸 用户 ${index + 1}\n` +
        `├─🚫 用户ID：\`${user.target.id}\`\n` +
        `├─📛 全称：${user.target.name}\n` +
        `├─📧 用户名：${user.target.username === '无' ? '（未设置）' : '@'+user.target.username}\n` +
        `├─🛡️ 操作人：${operatorInfo}\n` +
        `└─⏰ 时间：${formatAdminTime(new Date(user.timestamp))}`;
    }).join('\n\n');
    const finalText = template
      .replace('{{count}}', blockedUsers.length)
      .replace('{{users}}', usersSection)
      .replace('{{updateTime}}', formatAdminTime());
    return sendPhoto({
      chat_id: ADMIN_UID,
      photo: handleBlockListBgImage,
      caption: finalText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  } catch (error) {
    console.error('屏蔽列表处理失败:', error);
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `⚠️ 屏蔽列表加载失败：${error.message}`
    });
  }
}
async function registerWebhook(event, requestUrl, suffix, secret) {
  try {
    const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`;
    const response = await fetch(apiUrl('setWebhook', {
      url: webhookUrl,
      secret_token: secret
    }));
    const result = await response.json();
    return new Response(result.ok ? 'Webhook 注册成功 ✅' : `错误: ${result.description}`);
  } catch (error) {
    return new Response(`严重错误: ${error.message}`, { status: 500 });
  }
}
async function unRegisterWebhook(event) {
  try {
    const response = await fetch(apiUrl('deleteWebhook'));
    const result = await response.json();
    return new Response(result.ok ? 'Webhook 取消注册成功 ✅' : `错误: ${result.description}`);
  } catch (error) {
    return new Response(`严重错误: ${error.message}`, { status: 500 });
  }
}
async function isFraud(id) {
  id = id.toString();
  let db = await fetch(fraudDb).then(r => r.text());
  let arr = db.split('\n').filter(v => v);
  return arr.filter(v => v === id).length !== 0;
}

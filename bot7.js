/******************** 常量定义模块 ********************/
const TOKEN = ENV_BOT_TOKEN;
const WEBHOOK = '/endpoint';
const SECRET = ENV_BOT_SECRET;
const ADMIN_UID = ENV_ADMIN_UID;

const NOTIFY_INTERVAL = 7 * 24 * 3600 * 1000;
const fraudDb = 'https://raw.githubusercontent.com/LloydAsp/nfd/main/data/fraud.db'; // 远程欺诈用户数据库URL
const notificationUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/notification.txt'; // 定期通知消息模板
const startMsgUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/startMessage.md'; // 用户首次使用/start命令的欢迎消息模板
const userDataTemplateUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/userdata.md'; // 用户信息查询模板
const helpTemplateUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/helpMessage.md'; // 帮助菜单模板
const blockListTemplateUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/blockListTemplate.md'; // 屏蔽用户列表模板
const fraudListTemplateUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/fraudListTemplate.md'; // 欺诈用户列表模板

// 以下为各功能模块背景图片
const statusBgImage = 'https://img.siyouyun.eu.org/file/1740571550415_IMG_2365.png'; // 机器人状态背景图
const helpBgImage = 'https://img.siyouyun.eu.org/file/1740569053174_IMG_2363.png'; // 帮助菜单背景图
const blockBgImage = 'https://img.siyouyun.eu.org/file/1740571550415_IMG_2365.png'; // 屏蔽用户确认界面背景
const unblockBgImage = 'https://img.siyouyun.eu.org/file/1740568575434_IMG_2364.png'; // 解除屏蔽确认界面背景
const addFraudBgImage = 'https://img.siyouyun.eu.org/file/1740571550415_IMG_2365.png'; // 添加欺诈用户确认背景
const removeFraudBgImage = 'https://img.siyouyun.eu.org/file/1740568575434_IMG_2364.png'; // 移除欺诈用户确认背景
const checkStatusBgImage = 'https://img.siyouyun.eu.org/file/1740568575434_IMG_2364.png'; // 检查状态背景图
const LOCAL_FRAUD_PREFIX = 'fraud-local-';

const enable_notification = false;
/******************** API 工具函数模块 ********************/

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

// 发送消息
function sendMessage(msg = {}) {
  return requestTelegram('sendMessage', makeReqBody(msg));
}

// 发送图片消息
function sendPhoto(msg = {}) {
  return requestTelegram('sendPhoto', makeReqBody(msg));
}

// 复制消息
function copyMessage(msg = {}) {
  return requestTelegram('copyMessage', makeReqBody(msg));
}

// 转发消息
function forwardMessage(msg) {
  return requestTelegram('forwardMessage', makeReqBody(msg));
}

// 删除消息
function deleteMessage(msg = {}) {
  return requestTelegram('deleteMessage', makeReqBody(msg));
}

// 获取用户信息方法
function getChat(chat_id) {
  return requestTelegram('getChat', null, { chat_id });
}

//事件监听模块
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
//Webhook 处理模块
// 处理 webhook 请求
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

      case 'cancel_unblock':
        await editMessageText({
          chat_id: message.chat.id,
          message_id: message.message_id,
          text: "❌ 操作已取消"
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

// 实际执行屏蔽的方法
async function performBlock(userId) {
  // 获取被屏蔽用户的信息
  const targetUser = await getChat(userId);
  
  // 获取管理员自身的信息
  const operatorInfo = await getChat(ADMIN_UID);

  // 完整存储对象结构
  const storeData = {
    target: {
      id: userId,
      // ✅ 规范存储姓+名组合方式
      name: [
        targetUser.result.last_name, 
        targetUser.result.first_name
      ].filter(Boolean).join(' ') || '未知',
      username: targetUser.result.username || '无'
    },
    operator: {
      // ✅ 特别处理操作者的姓名展示
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

// 编辑消息的辅助方法
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

/******************** 消息处理模块 ********************/
// 处理收到的消息
async function onMessage(message) {
  if (message.text && message.text.startsWith('/') && message.text !== '/start') {
    if (message.chat.id.toString() !== ADMIN_UID) {
      const sentMessage = await sendMessage({
        chat_id: message.chat.id,
        text: '⚠️ 该指令仅主人可用'
      });
      return; // 终止后续处理
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

  // 管理员命令处理
  if (message.chat.id.toString() === ADMIN_UID) {
    if (/^\/blocklist$/.test(message.text)) {
      return handleBlockList(message);
    }
    if (/^\/fraud(_add)?(?:\s+(\d+))?$/.exec(message.text)) {
      const userId = message.text.split(' ')[1];
      return handleFraudCommand(message, userId);
    }
    if (/^\/unfraud(_remove)?(?:\s+(\d+))?$/.exec(message.text)) {
      const userId = message.text.split(' ')[1];
      return handleUnfraudCommand(message, userId);
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

  // 处理普通用户消息
  return handleGuestMessage(message);
}
/******************** 管理员命令处理模块 ********************/
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

// 处理帮助命令
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

// 处理状态命令
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

// 获取本地屏蔽用户数量
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

async function handleFraudCommand(message, userId) {
  // 两种模式判断
  if (userId) { // 通过指令参数添加
    return handleFraudByUserId(message, userId);
  }
  
  if (message.reply_to_message) { // 通过回复消息添加
    return handleFraudByReply(message);
  }

  // 错误处理
  return sendMessage({
    chat_id: ADMIN_UID,
    text: '❌ 使用方式：\n'
      + '1. 回复用户消息发送 /fraud\n'
      + '2. 直接输入 /fraud <用户ID>'
  });
}

async function handleUnfraudCommand(message, userId) {
  if (userId) { // 通过指令参数移除
    return handleUnfraudByUserId(message, userId);
  }
  
  if (message.reply_to_message) { // 通过回复消息移除
    return handleUnfraudByReply(message);
  }

  return sendMessage({
    chat_id: ADMIN_UID,
    text: '❌ 使用方式：\n'
      + '1. 回复用户消息发送 /unfraud\n'
      + '2. 直接输入 /unfraud <用户ID>'
  });
}

async function handleUnfraudCommand(message, userId) {
  if (userId) { // 通过指令参数移除
    return handleUnfraudByUserId(message, userId);
  }
  
  if (message.reply_to_message) { // 通过回复消息移除
    return handleUnfraudByReply(message);
  }

  return sendMessage({
    chat_id: ADMIN_UID,
    text: '❌ 使用方式：\n'
      + '1. 回复用户消息发送 /unfraud\n'
      + '2. 直接输入 /unfraud <用户ID>'
  });
}


// 获取本地欺诈用户数量
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
/******************** 时间格式化工具函数 ********************/
// 格式化管理时间
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
/******************** 欺诈用户处理模块 ********************/
// 检查本地欺诈用户
async function isLocalFraud(id) {
  const record = await lBot.get(LOCAL_FRAUD_PREFIX + id, { type: 'json' });
  return !!record;
}
// 合并检查欺诈用户（远程+本地）
async function checkFraud(id) {
  const remoteCheck = await isFraud(id);
  const localCheck = await isLocalFraud(id);
  return remoteCheck || localCheck;
}
// 处理本地欺诈用户列表
async function handleLocalFraudList(message) {
  try {
    const [template, fraudList] = await Promise.all([
      fetch(fraudListTemplateUrl).then(r => r.text()),
      loadFraudDataFromStorage()
    ]);

    const usersSection = fraudList.map((user, index) => {
      const operatorInfo = user.operator.username 
        ? `${user.operator.name} (@${user.operator.username})`
        : user.operator.name;
      
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
      photo: 'https://img.siyouyun.eu.org/file/1740571550415_IMG_2365.png',
      caption: finalText,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
  } catch (error) {
    console.error('欺诈列表处理失败:', error);
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `⚠️ 欺诈列表加载失败：${error.message}`
    });
  }
}

// 数据加载辅助函数
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
        { text: "✅ 确认添加", callback_data: `confirm_add_fraud:${guestChatId}`},
        { text: "👤 查看资料", callback_data: `view_profile:${guestChatId}`}
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


// 实际执行添加欺诈用户的方法
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

// 添加本地欺诈用户
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
          { text: "✅ 确认添加", callback_data: `confirm_add_fraud:${userId}`},
          { text: "👤 查看资料", callback_data: `view_profile:${userId}`}
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

// 移除本地欺诈用户
async function handleUnfraudByReply(message) {
  const guestChatId = await lBot.get('msg-map-' + message.reply_to_message.message_id, { type: "json" });

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
        chat_id: ADMIN_UID,
        text: `⚠️ 访客 ${userId} 不在欺诈名单中`
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

/******************** 普通用户消息处理模块 ********************/
// 处理普通用户消息
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
  setTimeout(async () => { // ✅ 添加 async
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
// 处理通知
async function handleNotify(message) {
  let chatId = message.chat.id;
  // 合并检查欺诈状态
  const isFraudUser = await checkFraud(chatId);
  if (isFraudUser) {
    // 组合用户姓名
    let fullName = '';
    if (message.from.first_name || message.from.last_name) {
      fullName = [message.from.first_name, message.from.last_name]
        .filter(Boolean)
        .join(' ');
    } else {
      fullName = '无';
    }
    // 构造报告文本
    const reportText = `📛 欺诈访客消息报警\n\n` +
      `用户ID：\`${chatId}\`\n` +
      `用户名：@${message.from.username || '无'}\n` +
      `姓名：${fullName}\n` +
      `消息内容：\n\`\`\`\n${message.text || '（非文本消息）'}\n\`\`\``;

    // 发送报警消息
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
/******************** 用户信息查询处理模块 ********************/
// 用户信息查询处理
async function handleUserInfo(message, userId) {
  try {
    const chatRes = await getChat(userId);
    if (!chatRes.ok) {
      return sendMessage({
        chat_id: ADMIN_UID,
        text: `❌ 获取用户信息失败：${chatRes.description || '未知错误'}`
      });
    }

    // 获取模板并填充数据
    const template = await fetch(userDataTemplateUrl).then(r => r.text());
    const user = chatRes.result;

    const filledTemplate = template
      .replace('{{userid}}', user.id)
      .replace('{{fullname}}', [user.last_name, user.first_name].filter(n => n && n.trim()).join(' ') || '未设置')
      .replace('{{username}}', user.username ? '@' + user.username : '无')
      .replace('{{isbot}}', user.is_bot ? '是 🤖' : '否 👤')
      .replace('{{lang}}', user.language_code || '未知')
      .replace('{{status}}', '🔍 活跃度分析需高级权限');

    // 发送图片消息
    return sendPhoto({
      chat_id: ADMIN_UID,
      photo: 'https://img.siyouyun.eu.org/file/1740557604080_p0 2.png',
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
/******************** 屏蔽与解屏蔽用户模块 ********************/
// 屏蔽用户（修正后的完整函数）
async function handleBlock(message) {
  let guestChatId = await lBot.get('msg-map-' + message.reply_to_message.message_id, { type: "json" });

  if (guestChatId === ADMIN_UID.toString()) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: '❌ 不能屏蔽自己'
    });
  }

  const confirmKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ 确认屏蔽", callback_data: `confirm_block:${guestChatId}` },
        { text: "👤 查看资料", callback_data: `view_profile:${guestChatId}` }
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
} // ✅ 函数在此正确结束

// 解除屏蔽用户
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

// 检查是否被屏蔽
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
      photo: checkStatusBgImage, // 使用背景图片
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

// 通过 ID 解除屏蔽
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
/******************** 查看被屏蔽的用户列表模块 ********************/
// 查看被屏蔽的用户列表
async function handleBlockList(message) {
  try {
    const [template, blockedUsers] = await Promise.all([
      fetch(blockListTemplateUrl).then(r => r.text()),
      loadBlockedUsersData()
    ]);

    const usersSection = blockedUsers.map((user, index) => {
      const operatorInfo = user.operator.username 
        ? `${user.operator.name} (@${user.operator.username})`
        : user.operator.name;
      
      return `🔸 用户 ${index + 1}\n` +
        `├─🚫 用户ID：\`${user.target.id}\`\n` +
        `├─📛 全称：${user.target.name}\n` +
        `├─📧 用户名：${user.target.username === '无' ? '（未设置）' : '@'+user.target.username}\n` +
        `├─🛡️ 操作人：${operatorInfo}\n` +
        `└─⏰ 时间：${formatAdminTime(new Date(user.timestamp))}`;
    }).join('\n\n');

    const finalText = template
      .replace('{{count}}', blockedUsers.length)
      .replace('{{users}}', blockedUsers.length ? usersSection : '当前无屏蔽用户')
      .replace('{{updateTime}}', formatAdminTime());

    return sendPhoto({
      chat_id: ADMIN_UID,
      photo: 'https://img.siyouyun.eu.org/file/1740568575434_IMG_2364.png',
      caption: finalText,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('屏蔽列表处理失败:', error);
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `⚠️ 屏蔽列表加载失败：${error.message}`
    });
  }
}
/******************** Webhook 注册与取消模块 ********************/

// 注册 webhook
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

// 取消注册 webhook
async function unRegisterWebhook(event) {
  try {
    const response = await fetch(apiUrl('deleteWebhook'));
    const result = await response.json();
    return new Response(result.ok ? 'Webhook 取消注册成功 ✅' : `错误: ${result.description}`);
  } catch (error) {
    return new Response(`严重错误: ${error.message}`, { status: 500 });
  }
}
/******************** 远程欺诈用户检查模块 ********************/
// 判断用户是否为骗子（远程检查）
async function isFraud(id) {
  id = id.toString();
  let db = await fetch(fraudDb).then(r => r.text());
  let arr = db.split('\n').filter(v => v);
  return arr.filter(v => v === id).length !== 0;
}

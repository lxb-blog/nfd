
const TOKEN = ENV_BOT_TOKEN // 从 @BotFather 获取的令牌
const WEBHOOK = '/endpoint' // 设置 Webhook 的路径
const SECRET = ENV_BOT_SECRET // Webhook 的密钥，A-Z, a-z, 0-9, _ 和 -
const ADMIN_UID = ENV_ADMIN_UID // 管理员的用户 ID，可以从 https://t.me/username_to_id_bot 获取

const NOTIFY_INTERVAL = 7 * 24 * 3600 * 1000; // 通知间隔时间，7天
const fraudDb = 'https://raw.githubusercontent.com/LloydAsp/nfd/main/data/fraud.db'; // 欺诈用户数据库的 URL
const notificationUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/notification.txt'; // 通知内容 URL
const startMsgUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/startMessage.md'; // 启动消息的 URL
const userDataTemplateUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/userdata.md';
const fraudListTemplateUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/fraudList.md'
const LOCAL_FRAUD_PREFIX = 'fraud-local-' // 本地欺诈用户存储前缀

const enable_notification = false // 是否启用通知功能

// 构建 API 请求 URL
function apiUrl(methodName, params = null) {
  let query = ''
  if (params) {
    query = '?' + new URLSearchParams(params).toString()
  }
  return `https://api.telegram.org/bot${TOKEN}/${methodName}${query}`
}

// 发起请求到 Telegram API
function requestTelegram(methodName, body, params = null) {
  return fetch(apiUrl(methodName, params), body)
    .then(r => r.json())
}

// 构建请求体
function makeReqBody(body) {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  }
}

// 发送消息
function sendMessage(msg = {}) {
  return requestTelegram('sendMessage', makeReqBody(msg))
}

// 发送图片消息
function sendPhoto(msg = {}) {
  return requestTelegram('sendPhoto', makeReqBody(msg))
}

// 复制消息
function copyMessage(msg = {}) {
  return requestTelegram('copyMessage', makeReqBody(msg))
}

// 转发消息
function forwardMessage(msg) {
  return requestTelegram('forwardMessage', makeReqBody(msg))
}

// 删除消息
function deleteMessage(msg = {}) {
  return requestTelegram('deleteMessage', makeReqBody(msg))
}

// 获取用户信息方法
function getChat(chat_id) {
  return requestTelegram('getChat', null, { chat_id });
}

// 事件监听器，处理 webhook 请求
addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (url.pathname === WEBHOOK) {
    event.respondWith(handleWebhook(event)) // 处理 webhook 请求
  } else if (url.pathname === '/registerWebhook') {
    event.respondWith(registerWebhook(event, url, WEBHOOK, SECRET)) // 注册 webhook
  } else if (url.pathname === '/unRegisterWebhook') {
    event.respondWith(unRegisterWebhook(event)) // 取消注册 webhook
  } else {
    event.respondWith(new Response('No handler for this request')) // 没有处理此请求的方式
  }
})

// 处理 webhook 请求
async function handleWebhook(event) {
  // 验证请求的 secret token
  if (event.request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== SECRET) {
    return new Response('Unauthorized', { status: 403 }) // 如果密钥不匹配，返回 403
  }

  const update = await event.request.json() // 获取 webhook 请求的内容
  event.waitUntil(onUpdate(update)) // 处理更新消息

  return new Response('Ok') // 返回成功响应
}

// 处理消息更新
async function onUpdate(update) {
  if ('message' in update) {
    await onMessage(update.message) // 如果有消息，则处理消息
  }
}

// 处理收到的消息
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

  // 管理员命令处理
  if (message.chat.id.toString() === ADMIN_UID) {
    // 原有命令
    if (/^\/blocklist$/.test(message.text)) {
      return handleBlockList(message);
    }
    if (/^\/userinfo\s+\d+$/.test(message.text)) {
      const userId = message.text.split(' ')[1];
      return handleUserInfo(message, userId);
    }
    if (/^\/unblockid\s+\d+$/.test(message.text)) {
      const userId = message.text.split(' ')[1];
      return handleUnBlockById(message, userId);
    }
    
    // 新增欺诈管理命令
    if (/^\/addfraud\s+\d+$/.test(message.text)) {
      const userId = message.text.split(' ')[1];
      return handleAddFraudUser(message, userId);
    }
    if (/^\/removefraud\s+\d+$/.test(message.text)) {
      const userId = message.text.split(' ')[1];
      return handleRemoveFraudUser(message, userId);
    }
    if (/^\/localfraudlist$/.test(message.text)) {
      return handleLocalFraudList(message);
    }
    if (message.text === '/help') {
      return sendMessage({
        chat_id: ADMIN_UID,
        text: `
  🛠️ *管理指令手册* 🛠️
  
  1️⃣ 🕵️ _屏蔽用户管理_
     ▶️ 屏蔽用户 ➖ 回复消息并发送 \`/block\`
     ▶️ 解除屏蔽 ➕ 回复消息并发送 \`/unblock\`
     ▶️ 检查状态 🔍 回复消息并发送 \`/checkblock\`
     ▶️ 屏蔽列表 📋 直接发送 \`/blocklist\`
     ▶️ ID解除锁 🔓 发送 \`/unblockid ➕ 🆔\`
  
  2️⃣ 💬 _消息处理_
     ▶️ 回复用户消息 ➡️ 直接回复机器人转发的消息
  
  3️⃣ 🔍 _用户信息查询_
     ▶️ 查ID详细信息 🔎 发送 \`/userinfo ➕ 🆔\`
  
  4️⃣ 🚨 _欺诈用户管理_
     ➕ 添加骗子 ➡️ \`/addfraud ➕ 🆔\`
     ➖ 移除骗子 ➡️ \`/removefraud ➕ 🆔\`
     📜 骗子列表 ➡️ \`/localfraudlist\`

        `,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
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
    
    let guestChantId = await lBot.get('msg-map-' + message?.reply_to_message.message_id,
      { type: "json" })
    return copyMessage({
      chat_id: guestChantId,
      from_chat_id: message.chat.id,
      message_id: message.message_id,
    })
  }

  // 处理普通用户消息
  return handleGuestMessage(message);
}

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

// 检查本地欺诈用户
async function isLocalFraud(id) {
  const record = await lBot.get(LOCAL_FRAUD_PREFIX + id, { type: 'json' })
  return !!record
}

// 合并检查欺诈用户（远程+本地）
async function checkFraud(id) {
  const remoteCheck = await isFraud(id)
  const localCheck = await isLocalFraud(id)
  return remoteCheck || localCheck
}

// 处理本地欺诈用户列表
async function handleLocalFraudList(message) {
  // [1] 获取模板和用户数据
  const [template, fraudList] = await Promise.all([
    fetch(fraudListTemplateUrl).then(r => r.text()),
    loadFraudDataFromStorage()
  ]);

  // [2] 生成用户信息列表
  const usersSection = fraudList.map((user, index) => {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '未命名';
    return `┣✦ **用户 ${index + 1}**\n` +
           `┃・🆔 ID：\`${user.id}\`\n` +
           `┃・📧 用户名：${user.username ? '@' + user.username : '无'}\n` +
           `┃・👤 姓名：${fullName}\n` +
           `┃・🛠️ 操作人：\`${user.operator}\`\n` +
           `┃・⏳ 时间：\`${formatAdminTime(new Date(user.timestamp))}\`\n` +
           `┗━━━━━━━━━━━━━━`;
  }).join('\n\n');

  // [3] 组合完整消息
  const finalText = template
    .replace('{{count}}', fraudList.length)
    .replace('{{users}}', fraudList.length ? usersSection : '当前无欺诈用户记录')
    .replace('{{updateTime}}', formatAdminTime());

  // [4] 发送消息
  return sendMessage({
    chat_id: ADMIN_UID,
    text: finalText,
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}

// 新增数据加载辅助函数
async function loadFraudDataFromStorage() {
  const users = [];
  let cursor = null;
  do {
    const list = await lBot.list({ prefix: LOCAL_FRAUD_PREFIX, cursor });
    for (const key of list.keys) {
      const rawData = await lBot.get(key.name, { type: 'json' });
      users.push({
        id: key.name.replace(LOCAL_FRAUD_PREFIX, ''),
        ...rawData // 自动包含新的用户名和姓名字段
      });
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);
  return users;
}

// 添加本地欺诈用户
async function handleAddFraudUser(message, userId) {
  try {
    const userCheck = await getChat(userId)
    if (!userCheck.ok) {
      return sendMessage({
        chat_id: ADMIN_UID,
        text: `❌ 用户不存在：${userCheck.description}`
      })
    }

    const existing = await lBot.get(LOCAL_FRAUD_PREFIX + userId, { type: 'json' })
    if (existing) {
      return sendMessage({
        chat_id: ADMIN_UID,
        text: `⚠️ 用户 ${userId} 已在本地欺诈列表中`
      })
    }

    // 获取用户详细信息
    const targetUser = userCheck.result;
    await lBot.put(LOCAL_FRAUD_PREFIX + userId, JSON.stringify({
      operator: message.from.id,
      timestamp: Date.now(),
      username: targetUser.username || null,
      firstName: targetUser.first_name || null,
      lastName: targetUser.last_name || null
    }))

    return sendMessage({
      chat_id: ADMIN_UID,
      text: `✅ 已添加用户 \`${userId}\` 到本地欺诈列表`,
      parse_mode: 'Markdown'
    })
  } catch (error) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `❌ 操作失败：${error.message}`
    })
  }
}

// 移除本地欺诈用户
async function handleRemoveFraudUser(message, userId) {
  try {
    const existing = await lBot.get(LOCAL_FRAUD_PREFIX + userId, { type: 'json' })
    if (!existing) {
      return sendMessage({
        chat_id: ADMIN_UID,
        text: `⚠️ 用户 ${userId} 不在本地欺诈列表中`
      })
    }

    await lBot.delete(LOCAL_FRAUD_PREFIX + userId)
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `✅ 已从本地欺诈列表移除用户 \`${userId}\``,
      parse_mode: 'Markdown'
    })
  } catch (error) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `❌ 操作失败：${error.message}`
    })
  }
}

// 以下保持原有功能不变（包含完整实现） █

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

// 用户信息查询处理
// 修改后的用户信息处理逻辑
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
      .replace('{{fullname}}', [user.first_name, user.last_name].filter(Boolean).join(' ') || '未设置')
      .replace('{{username}}', user.username ? '@' + user.username : '无')
      .replace('{{isbot}}', user.is_bot ? '是 🤖' : '否 👤')
      .replace('{{lang}}', user.language_code || '未知')
      .replace('{{status}}', '🔍 活跃度分析需高级权限');

    // 发送图片消息
    return sendPhoto({
      chat_id: ADMIN_UID,
      photo: 'https://img.siyouyun.eu.org/file/1740557604080_p0 2.png', // 查询用户信息的图片URL
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

// 处理通知
async function handleNotify(message) {
  let chatId = message.chat.id;
  // 合并检查欺诈状态
  const isFraudUser = await checkFraud(chatId);
  
  if (isFraudUser) {
    const reportText = `🛑 欺诈用户消息报警\n\n` +
      `用户ID：\`${chatId}\`\n` +
      `用户名：@${message.from.username || '无'}\n` +
      `消息内容：\n\`\`\`\n${message.text || '（非文本消息）'}\n\`\`\``

    await sendMessage({
      chat_id: ADMIN_UID,
      text: reportText,
      parse_mode: 'Markdown'
    });

    const forwardResult = await forwardMessage({
      chat_id: ADMIN_UID,
      from_chat_id: message.chat.id,
      message_id: message.message_id
    });

    if (forwardResult.ok) {
      await sendMessage({
        chat_id: ADMIN_UID,
        text: `⚠️ 以上消息来自被标记的欺诈用户（ID：\`${chatId}\`）`,
        parse_mode: 'Markdown',
        reply_to_message_id: forwardResult.result.message_id
      });
    }
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

// 屏蔽用户
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

// 解除屏蔽用户
async function handleUnBlock(message) {
  let guestChantId = await lBot.get('msg-map-' + message.reply_to_message.message_id,
    { type: "json" })

  await lBot.put('isblocked-' + guestChantId, false)

  return sendMessage({
    chat_id: ADMIN_UID,
    text: `UID:${guestChantId}解除屏蔽成功`,
  })
}

// 检查是否被屏蔽
async function checkBlock(message) {
  let guestChantId = await lBot.get('msg-map-' + message.reply_to_message.message_id,
    { type: "json" })
  let blocked = await lBot.get('isblocked-' + guestChantId, { type: "json" })

  return sendMessage({
    chat_id: ADMIN_UID,
    text: `UID:${guestChantId}` + (blocked ? '被屏蔽' : '没有被屏蔽')
  })
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

    await lBot.put('isblocked-' + userId, false);

    return sendMessage({
      chat_id: ADMIN_UID,
      text: `✅ 已解除屏蔽用户：${userId}`,
      parse_mode: 'Markdown'
    });

  } catch (error) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `⚠️ 解除屏蔽失败：${error.message}`
    });
  }
}

// 查看被屏蔽的用户列表
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

// 判断用户是否为骗子（远程检查）
async function isFraud(id) {
  id = id.toString()
  let db = await fetch(fraudDb).then(r => r.text())
  let arr = db.split('\n').filter(v => v)
  return arr.filter(v => v === id).length !== 0
}

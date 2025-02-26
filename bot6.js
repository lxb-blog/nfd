const TOKEN = ENV_BOT_TOKEN // 从 @BotFather 获取的令牌
const WEBHOOK = '/endpoint' // 设置 Webhook 的路径
const SECRET = ENV_BOT_SECRET // Webhook 的密钥，A-Z, a-z, 0-9, _ 和 -
const ADMIN_UID = ENV_ADMIN_UID // 管理员的用户 ID，可以从 https://t.me/username_to_id_bot 获取

const NOTIFY_INTERVAL = 7 * 24 * 3600 * 1000; // 通知间隔时间，7天
const fraudDb = 'https://raw.githubusercontent.com/LloydAsp/nfd/main/data/fraud.db'; // 欺诈用户数据库的 URL
const notificationUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/notification.txt'; // 通知内容 URL
const startMsgUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/startMessage.md'; // 启动消息的 URL
const userDataTemplateUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/userdata.md';//用户信息模板
const fraudListTemplateUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/fraudList.md'//骗子列表模板
const helpTemplateUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/helpMessage.md' // 管理帮助模板
const statusBgImage = 'https://img.siyouyun.eu.org/file/1740571550415_IMG_2365.png' // 状态背景图
const helpBgImage = 'https://img.siyouyun.eu.org/file/1740569053174_IMG_2363.png'     // 帮助背景图
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
    if (/^\/userinfo\s+\d+$/.test(message.text)) {
      const userId = message.text.split(' ')[1];
      return handleUserInfo(message, userId);
    }
    if (/^\/unblockid\s+\d+$/.test(message.text)) {
      const userId = message.text.split(' ')[1];
      return handleUnBlockById(message, userId);
    }
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
  return handleHelpCommand(message); // 修改此处
}
if (message.text === '/status') {    // 新增状态命令
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
  try {
    // [1] 获取模板和数据
    const [template, fraudList] = await Promise.all([
      fetch(fraudListTemplateUrl).then(r => r.text()),
      loadFraudDataFromStorage()
    ]);

    // [2] 生成用户列表
    const usersSection = fraudList.map((user, index) => 
      `▫️ 用户 ${index + 1}\n` +
      `├─🆔 ID：\`${user.id}\`\n` +
      `├─📛 名称：${user.firstName || '无'} ${user.lastName || ''}\n` +
      `└─🕵️ 操作人：${user.operator}`
    ).join('\n\n');

    // [3] 填充模板
    const finalText = template
      .replace('{{count}}', fraudList.length)
      .replace('{{users}}', fraudList.length ? usersSection : '当前无欺诈访客记录')
      .replace('{{updateTime}}', formatAdminTime());

    // [4] 发送图片消息
    return sendPhoto({
      chat_id: ADMIN_UID,
      photo: 'https://img.siyouyun.eu.org/file/1740548062053_p0.png', // 骗子哪里的图片
      caption: finalText,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });

  } catch (error) {
    // 降级为文本消息
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `⚠️ 图片加载失败，以下是文本格式：\n\n${finalText}`,
      parse_mode: 'Markdown'
    });
  }
}
// 数据加载辅助函数
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
        text: `❌ 访客不存在：${userCheck.description}`
      })
    }

    const existing = await lBot.get(LOCAL_FRAUD_PREFIX + userId, { type: 'json' })
    if (existing) {
      return sendMessage({
        chat_id: ADMIN_UID,
        text: `⚠️ 访客 ${userId} 已在本地欺诈列表中`
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
      text: `✅ 已添加访客 \`${userId}\` 到本地欺诈列表`,
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
        text: `⚠️ 访客 ${userId} 不在本地欺诈列表中`
      })
    }

    await lBot.delete(LOCAL_FRAUD_PREFIX + userId)
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `✅ 已从本地欺诈列表移除该访客 \`${userId}\``,
      parse_mode: 'Markdown'
    })
  } catch (error) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `❌ 操作失败：${error.message}`
    })
  }
}



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
      text: '❌ 不能屏蔽自己'
    })
  }

  // 获取用户详情
  const userCheck = await getChat(guestChantId)
  if (!userCheck.ok) {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `❌ 用户查询失败：${userCheck.description}`
    })
  }

  // 构建存储数据
  const userData = {
    id: guestChantId,
    username: userCheck.result.username || "无",
    firstName: userCheck.result.first_name || "未知",
    lastName: userCheck.result.last_name || "",
    operator: message.from.id,  // 操作人UID
    timestamp: Date.now()
  }

  // 持久化存储
  await lBot.put('isblocked-' + guestChantId, JSON.stringify(userData))

  return sendMessage({
    chat_id: ADMIN_UID,
    text: `🚫 用户已屏蔽\n\n` +
          `▫️ 用户ID：\`${guestChantId}\`\n` +
          `▫️ 用户名：@${userCheck.result.username || '无'}\n` +
          `▫️ 姓  名：${userCheck.result.first_name || ''} ${userCheck.result.last_name || ''}\n` +
          `▫️ 操作时间：${formatAdminTime()}`,
    parse_mode: 'Markdown'
  })
}

// 解除屏蔽用户
async function handleUnBlock(message) {
  let guestChantId = await lBot.get('msg-map-' + message.reply_to_message.message_id,
    { type: "json" })

  // 删除记录
  await lBot.delete('isblocked-' + guestChantId)

  return sendMessage({
    chat_id: ADMIN_UID,
    text: `✅ UID ${guestChantId} 已解除屏蔽`,
    parse_mode: 'Markdown'
  })
}


// 检查是否被屏蔽
async function checkBlock(message) {
  let guestChantId = await lBot.get('msg-map-' + message.reply_to_message.message_id,
    { type: "json" })
  
  const blockedData = await lBot.get('isblocked-' + guestChantId, { type: "json" })
  
  if (blockedData) {
    const info = typeof blockedData === 'object' ? 
      `📌 详细信息\n` +
      `├─用户名：@${blockedData.username}\n` +
      `├─姓 名：${blockedData.firstName} ${blockedData.lastName}\n` +
      `├─操作者：${blockedData.operator}\n` +
      `└─屏蔽时间：${formatAdminTime(new Date(blockedData.timestamp))}` 
      : '⚠️ 旧格式数据，需要重新屏蔽一次以升级'
      
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `🔒 UID ${guestChantId} 处于屏蔽状态\n\n${info}`,
      parse_mode: 'Markdown'
    })
  }
  
  return sendMessage({
    chat_id: ADMIN_UID,
    text: `🔓 UID ${guestChantId} 未被屏蔽`
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

// 查看被屏蔽的用户列表
async function handleBlockList(message) {
  let blockedUsers = [];
  let cursor = null;

  // 遍历所有屏蔽记录
  do {
    const list = await lBot.list({ prefix: 'isblocked-', cursor });
    for (const key of list.keys) {
      const record = await lBot.get(key.name, { type: "json" })
      if (record) {
        // 兼容旧数据格式
        if (typeof record === 'boolean') {
          blockedUsers.push({
            id: key.name.replace('isblocked-', ''),
            legacy: true
          })
        } else {
          blockedUsers.push({
            id: record.id,
            username: record.username,
            name: `${record.firstName} ${record.lastName}`,
            operator: record.operator,
            time: record.timestamp
          })
        }
      }
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);

  // 生成格式化的列表信息
  const formattedList = blockedUsers.map((user, index) => 
    `🔸 用户 ${index + 1}\n` +
    (user.legacy 
      ? `├─🆔 ID：\`${user.id}\`\n└─❕ 旧格式数据`
      : `├─🆔 ID：\`${user.id}\`\n` +
        `├─📛 名称：${user.name.trim() || '无'}\n` +
        `├─📧 用户名：@${user.username}\n` +
        `├─👤 操作者：${user.operator}\n` +
        `└─⏰ 屏蔽时间：${formatAdminTime(new Date(user.time))}`)
  ).join('\n\n');

  return sendPhoto({
    chat_id: ADMIN_UID,
    photo: 'https://img.siyouyun.eu.org/file/1740568575434_IMG_2364.png',//查看屏蔽列表的图片
    caption: `📜 当前已屏蔽访客数：${blockedUsers.length}\n\n${formattedList}`,
    parse_mode: 'Markdown'
  })
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

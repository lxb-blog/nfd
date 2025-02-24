const TOKEN = ENV_BOT_TOKEN // 从 @BotFather 获取
const WEBHOOK = '/endpoint'
const SECRET = ENV_BOT_SECRET // A-Z, a-z, 0-9, _ 和 -
const ADMIN_UID = ENV_ADMIN_UID // 你的用户 ID，从 https://t.me/username_to_id_bot 获取

const NOTIFY_INTERVAL = 7 * 24 * 3600 * 1000;
const fraudDb = 'https://raw.githubusercontent.com/LloydAsp/nfd/main/data/fraud.db';
const notificationUrl = 'https://raw.githubusercontent.com/LloydAsp/nfd/main/data/notification.txt'
const startMsgUrl = 'https://raw.githubusercontent.com/lxb-blog/nfd/refs/heads/main/data/startMessage.md';

const enable_notification = true

/**
 * 返回 Telegram API 的 URL，且可以选择添加参数
 */
function apiUrl (methodName, params = null) {
  let query = ''
  if (params) {
    query = '?' + new URLSearchParams(params).toString()
  }
  return `https://api.telegram.org/bot${TOKEN}/${methodName}${query}`
}

function requestTelegram(methodName, body, params = null){
  return fetch(apiUrl(methodName, params), body)
    .then(r => r.json())
}

function makeReqBody(body){
  return {
    method:'POST',
    headers:{
      'content-type':'application/json'
    },
    body:JSON.stringify(body)
  }
}

function sendMessage(msg = {}){
  return requestTelegram('sendMessage', makeReqBody(msg))
}

function copyMessage(msg = {}){
  return requestTelegram('copyMessage', makeReqBody(msg))
}

function forwardMessage(msg){
  return requestTelegram('forwardMessage', makeReqBody(msg))
}

/**
 * 监听请求
 */
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

/**
 * 处理 WEBHOOK 请求
 * https://core.telegram.org/bots/api#update
 */
async function handleWebhook (event) {
  // 检查 secret
  if (event.request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== SECRET) {
    return new Response('Unauthorized', { status: 403 })
  }

  // 同步读取请求体
  const update = await event.request.json()
  // 异步处理
  event.waitUntil(onUpdate(update))

  return new Response('Ok')
}

/**
 * 处理 incoming Update
 * https://core.telegram.org/bots/api#update
 */
async function onUpdate (update) {
  if ('message' in update) {
    await onMessage(update.message)
  }
}

/**
 * 处理 incoming Message
 * https://core.telegram.org/bots/api#message
 */
async function onMessage (message) {
  // 如果是 /start，发送欢迎信息
  if (message.text === '/start') {
    let startMsg = await fetch(startMsgUrl).then(r => r.text())
    
    // 获取用户名、姓名（first_name 和 last_name 合并）
    let firstName = message.from.first_name || '';
    let lastName = message.from.last_name || '';
    let fullName = firstName + (lastName ? ' ' + lastName : '') || '未知用户';
    
    // 获取用户的 id
    let userId = message.from.id;

    // 替换模板中的动态内容
    startMsg = startMsg.replace('{{username}}', fullName).replace('{{user_id}}', userId);
    
    // 创建一个按钮
    const keyboard = {
      inline_keyboard: [
        [{
          text: "李小白博客", 
          url: "https://blog.lxb.icu"
        }]
      ]
    };

    // 发送欢迎消息和按钮
    return sendMessage({
      chat_id: message.chat.id,
      text: startMsg,
      reply_markup: keyboard // 加入按钮
    })
  }

  // 管理员命令处理
  if (message.chat.id.toString() === ADMIN_UID) {
    if (!message?.reply_to_message?.chat) {
      return sendMessage({
        chat_id: ADMIN_UID,
        text: `使用方法：
  
  1. 🈲 屏蔽用户：
     - 回复某个用户的消息，发送 \`/block\`。
  
  2. ✅ 解除屏蔽：
     - 回复某个已屏蔽用户的消息，发送 \`/unblock\`。
  
  3. 🔍 检查用户屏蔽状态：
     - 回复某个用户的消息，发送 \`/checkblock\`。
  
  4. 💬 回复消息：
     - 回复某个用户的消息，发送一条回复消息，机器人会自动转发该消息到管理员界面或其他相关操作。`,
        parse_mode: 'Markdown' // 设置为 Markdown 格式
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
    let guestChantId = await nfd.get('msg-map-' + message?.reply_to_message.message_id, { type: "json" })
    return copyMessage({
      chat_id: guestChantId,
      from_chat_id: message.chat.id,
      message_id: message.message_id,
    })
  }

  return handleGuestMessage(message)
}

/**
 * 处理游客消息
 */
async function handleGuestMessage(message){
  let chatId = message.chat.id;
  let isblocked = await nfd.get('isblocked-' + chatId, { type: "json" })
  
  if(isblocked){
    return sendMessage({
      chat_id: chatId,
      text: '你已被屏蔽'
    })
  }

  let forwardReq = await forwardMessage({
    chat_id: ADMIN_UID,
    from_chat_id: message.chat.id,
    message_id: message.message_id
  })
  console.log(JSON.stringify(forwardReq))
  if(forwardReq.ok){
    await nfd.put('msg-map-' + forwardReq.result.message_id, chatId)
    
    // 转发成功后给访客回复“✅消息已送达”
    return sendMessage({
      chat_id: chatId,
      text: '✅消息已送达'
    })
  }
  return handleNotify(message)
}

/**
 * 处理通知
 */
async function handleNotify(message){
  let chatId = message.chat.id;
  if(await isFraud(chatId)){
    return sendMessage({
      chat_id: ADMIN_UID,
      text: `检测到骗子，UID${chatId}`
    })
  }
  if(enable_notification){
    let lastMsgTime = await nfd.get('lastmsg-' + chatId, { type: "json" })
    if(!lastMsgTime || Date.now() - lastMsgTime > NOTIFY_INTERVAL){
      await nfd.put('lastmsg-' + chatId, Date.now())
      return sendMessage({
        chat_id: ADMIN_UID,
        text: await fetch(notificationUrl).then(r => r.text())
      })
    }
  }
}

/**
 * 屏蔽用户
 */
async function handleBlock(message){
  let guestChantId = await nfd.get('msg-map-' + message.reply_to_message.message_id, { type: "json" })
  if(guestChantId === ADMIN_UID){
    return sendMessage({
      chat_id: ADMIN_UID,
      text: '不能屏蔽自己'
    })
  }
  await nfd.put('isblocked-' + guestChantId, true)

  return sendMessage({
    chat_id: ADMIN_UID,
    text: `UID:${guestChantId} 屏蔽成功`,
  })
}

/**
 * 解除屏蔽用户
 */
async function handleUnBlock(message){
  let guestChantId = await nfd.get('msg-map-' + message.reply_to_message.message_id, { type: "json" })
  await nfd.put('isblocked-' + guestChantId, false)

  return sendMessage({
    chat_id: ADMIN_UID,
    text: `UID:${guestChantId} 解除屏蔽成功`,
  })
}

/**
 * 查看是否被屏蔽
 */
async function checkBlock(message){
  let guestChantId = await nfd.get('msg-map-' + message.reply_to_message.message_id, { type: "json" })
  let blocked = await nfd.get('isblocked-' + guestChantId, { type: "json" })

  return sendMessage({
    chat_id: ADMIN_UID,
    text: `UID:${guestChantId}` + (blocked ? ' 被屏蔽' : ' 没有被屏蔽')
  })
}

/**
 * 发送纯文本消息
 */
async function sendPlainText (chatId, text) {
  return sendMessage({
    chat_id: chatId,
    text
  })
}

/**
 * 设置 webhook
 */
async function registerWebhook (event, requestUrl, suffix, secret) {
  const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`
  const r = await (await fetch(apiUrl('setWebhook', { url: webhookUrl, secret_token: secret }))).json()
  return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2))
}

/**
 * 移除 webhook
 */
async function unRegisterWebhook (event) {
  const r = await (await fetch(apiUrl('setWebhook', { url: '' }))).json()
  return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2))
}

/**
 * 判断是否是诈骗用户
 */
async function isFraud(id){
  id = id.toString()
  let db = await fetch(fraudDb).then(r => r.text())
  let arr = db.split('\n').filter(v => v)
  let flag = arr.filter(v => v === id).length !== 0
  return flag
}

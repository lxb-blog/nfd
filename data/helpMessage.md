
{{botName}} 管理手册 • 控制台指南

📊 当前系统状态
├─ 屏蔽访客：{{blockedCount}} 人
└─ 本地骗子：{{fraudCount}} 人

🔧 核心功能体系

1️⃣ 用户管理模块
   🛡️ 屏蔽系统
   ├─ 启动机器人会话：发送消息 /start
   ├─ 获取帮助信息：发送消息 /help
   ├─ 获取最新本地数据：发送消息 /status
   ├─ 查看指定id信息：发送消息 /userinfo
   ├─ 添加屏蔽：回复消息 /block
   ├─ 解除屏蔽：回复消息 /unblock
   ├─ 检查访客状态：回复消息 /checkblock
   ├─ 查看屏蔽用户列表：回复消息 /blocklist
   └─ 解除指定id屏蔽：回复消息 /unblockid [UID]

2️⃣ 欺诈防控体系
   🔍 云端检测：自动识别诈骗风险
   ├─ 本地欺诈库管理
   ├─ 查看名单：/localfraudlist
   ├─ 添加记录：/addfraud [UID]
   └─ 移除记录：/removefraud [UID]

3️⃣ 消息中枢功能
   📩 消息转发：自动同步用户消息
   ↔️ 双向沟通：直接回复即可发送

📌 最近刷新：{{updateTime}}

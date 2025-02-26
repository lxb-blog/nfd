
{{botName}} 管理手册 • 控制台指南

📊 当前系统状态
├─ 屏蔽用户：{{blockedCount}} 人
└─ 欺诈库容：{{fraudCount}} 条

🔧 核心功能体系

1️⃣ 用户管理模块
   🛡️ 屏蔽系统
   ├─ 添加屏蔽：回复消息 /block
   ├─ 解除屏蔽：回复消息 /unblock
   └─ 列表查询：/blocklist

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

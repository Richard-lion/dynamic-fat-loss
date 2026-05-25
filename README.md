# Dynamic Fat Loss Tracker

> 动态减脂拉锯战助手 — 基于实时数据动态调整碳水摄入的个人减脂工具。

## 功能

- **实时碳水计算**：根据当日热量缺口和运动量，动态计算最优碳水摄入量
- **Cycle Settlement**：每3天自动结算周期，数据滚动更新
- **数据分析**：体重趋势、热量缺口、碳水摄入历史
- **用户账号系统**：独立账号 + 密码，数据完全隔离

## 技术栈

- **Framework**: Next.js 14 (App Router)
- **部署**: Vercel
- **数据存储**: Vercel Serverless `/tmp`（文件持久化）
- **账号认证**: PBKDF2-SHA256 密码哈希（100k轮）+ HMAC-SHA256 Token（30天有效）
- **自定义域名**: `rvpn1900.cc.cd`

## Getting Started

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`

## 部署

push 到 `main` 分支自动触发 Vercel 部署。

**Domains**:
- Production: `https://rvpn1900.cc.cd`
- Fallback: `https://fat-loss-nextjs-plitt8th2-richards-projects-93ee63a0.vercel.app`

## 项目结构

```
src/
├── app/
│   ├── page.tsx          # 首页（登录跳转逻辑）
│   ├── login/page.tsx    # 登录/注册页
│   ├── app/page.tsx       # Dashboard
│   ├── analytics/page.tsx # 数据分析
│   └── api/               # API Routes
│       ├── auth/          # register, login
│       ├── onboarding/    # 用户初始化
│       ├── dashboard/     # 数据面板
│       ├── food-log/      # 食物记录
│       ├── weight/        # 体重记录
│       ├── cycle-settlement/ # 周期结算
│       └── analytics/     # 数据分析
└── lib/
    ├── auth.ts      # PBKDF2 哈希 + HMAC Token
    ├── accounts.ts  # 账号 CRUD
    ├── algorithm.ts # 碳水计算算法
    └── store.ts     # 用户数据存储
```

## 数据隔离

每个用户使用独立密码登录，Token 包含 `userId`，API 请求时解析 Token 获取用户身份，确保数据完全隔离。

## License

MIT
# TCI Customs Clearance Map — Phase 1：Supabase 建立 + 登入系統

> 將本文件完整交給 GPT，請它依照規格逐一產出程式碼。
> 目前狀態：已完成登入、登出、改密碼、自助註冊與角色讀取流程。

---

## 給 GPT 的指令

請依照以下規格，幫我建立 TCI 通關地圖的第一階段：Supabase 資料庫初始化與登入系統。

要求：
- 純 HTML + Vanilla JS，不使用任何框架或 npm
- Supabase JS Client 透過 CDN 引入
- 所有 Supabase 呼叫集中在 `js/api.js`
- 程式碼需有繁體中文註解
- 風格簡潔，適合公司內部工具

---

## 專案基本資訊

| 項目 | 內容 |
|------|------|
| 專案名稱 | TCI Customs Clearance Map |
| 前端部署 | GitHub Pages |
| 資料庫 | Supabase（PostgreSQL） |
| 登入方式 | Email + 密碼 |
| 限制信箱 | 僅 @tci-bio.com |
| 開發語言 | HTML + Vanilla JS |

---

## 檔案結構（Phase 1 需建立）

```
tci-customs-map/
├── index.html          # 首頁（暫時放登入檢查，導向 login.html）
├── login.html          # 登入頁面
├── register.html       # 自助註冊頁面
├── js/
│   ├── api.js          # 所有 Supabase 呼叫集中於此
│   └── auth.js         # 登入、登出、Session 管理
└── css/
    └── style.css       # 全站共用樣式
```

---

## Supabase 設定

### CDN 引入方式

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

### api.js 頂部設定

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL'
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

---

## Supabase SQL（請在 Supabase SQL Editor 執行）

```sql
-- 啟用 UUID 擴充
create extension if not exists "uuid-ossp";

-- 通關紀錄主表
create table customs_records (
  id uuid primary key default uuid_generate_v4(),
  country text not null,
  port text not null,
  dosage_form text not null,
  forwarder text,
  broker text,
  clearance_result text check (clearance_result in ('success', 'delayed', 'held', 'rejected')),
  clearance_days integer,
  required_documents text,
  risk_level text check (risk_level in ('green', 'yellow', 'red')),
  issue_supplement boolean default false,
  issue_held boolean default false,
  issue_delayed boolean default false,
  issue_note text,
  created_by uuid references auth.users(id),
  created_at timestamp default now(),
  last_updated timestamp default now()
);

-- 文件需求表
create table document_requirements (
  id uuid primary key default uuid_generate_v4(),
  country text not null,
  port text,
  dosage_form text,
  required_documents text not null,
  remarks text
);

-- Broker 名錄
create table broker_directory (
  id uuid primary key default uuid_generate_v4(),
  country text not null,
  port text,
  broker_name text not null,
  contact_info text,
  remarks text
);

-- 使用者角色表
create table user_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) unique,
  role text check (role in ('user', 'shipping', 'admin')) default 'user'
);

-- RLS 啟用
alter table customs_records enable row level security;
alter table document_requirements enable row level security;
alter table broker_directory enable row level security;
alter table user_roles enable row level security;

-- customs_records 政策
create policy "登入者可查詢通關紀錄" on customs_records
  for select using (auth.role() = 'authenticated');

create policy "shipping/admin 可新增通關紀錄" on customs_records
  for insert with check (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('shipping', 'admin')
    )
  );

create policy "shipping/admin 可編輯通關紀錄" on customs_records
  for update using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('shipping', 'admin')
    )
  );

-- document_requirements 政策
create policy "登入者可查詢文件需求" on document_requirements
  for select using (auth.role() = 'authenticated');

-- broker_directory 政策
create policy "登入者可查詢Broker" on broker_directory
  for select using (auth.role() = 'authenticated');

-- user_roles 政策
create policy "使用者可查詢自己的角色" on user_roles
  for select using (auth.uid() = user_id);
```

---

## 登入系統規格

### login.html 功能

- Email 輸入欄位
- 密碼輸入欄位
- 登入按鈕
- 錯誤訊息顯示區
- 登入成功後導向 `index.html`
- 若已登入則自動導向 `index.html`
- 提供前往 `register.html` 的建立帳號入口

### register.html 功能

- Email 輸入欄位
- 密碼與確認密碼欄位
- 密碼至少 6 碼，送出前檢查兩次密碼一致
- 呼叫 Supabase `auth.signUp`
- 若 Supabase 啟用 Email 驗證，註冊後提示使用者依信件完成驗證
- 新註冊帳號預設一般 `user` 權限，Shipping / Admin 權限由 Admin 後台指派

### auth.js 需實作的函式

```js
// 登入
async function signIn(email, password) { ... }

// 註冊
async function signUp(email, password) { ... }

// 登出
async function signOut() { ... }

// 取得目前登入使用者
async function getCurrentUser() { ... }

// 取得使用者角色（從 user_roles 表查詢）
async function getUserRole(userId) { ... }

// 檢查是否已登入，未登入則導向 login.html
async function requireAuth() { ... }

// 檢查是否為 shipping 或 admin，否則導向 index.html
async function requireShipping() { ... }
```

### index.html 功能（Phase 1 暫時版）

- 頁面載入時呼叫 `requireAuth()`
- 顯示目前登入者 Email 與角色
- 顯示登出按鈕
- 右上角導覽列：查詢（index.html）｜後台（admin/index.html，僅 shipping/admin 顯示）

---

## 樣式規格（style.css）

- 字體：系統字體（-apple-system, sans-serif）
- 主色：#1D9E75（綠色，品牌色）
- 背景：#F8F9FA
- 卡片：白色背景，1px border，border-radius 8px
- 按鈕：主色背景，白色文字，hover 略深
- 登入頁面置中顯示，最大寬度 400px
- RWD：支援手機瀏覽

---

## 注意事項

- `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 請用佔位符，開發者自行替換
- 信箱限制 `@tci-bio.com` 須在 Supabase Dashboard → Authentication → Settings 設定，非程式碼控制
- 新註冊使用者預設角色為 `user`；目前已可由 Admin 後台角色管理指派 `shipping` / `admin`
- 勿使用 `service_role` key，一律使用 `anon` key + RLS 控制權限
- 若 Admin 建立帳號功能的 Edge Function 尚未部署，前端會 fallback 到自助註冊流程並透過 RPC 指派角色

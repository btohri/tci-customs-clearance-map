# TCI Customs Clearance Map — V1 專案規格文件

> 本文件供 AI（Cursor / Copilot / Claude）閱讀使用，也作為接手人員的 README。
> 最後更新：2026-06-01

---

## 專案概述

**專案名稱**：TCI Customs Clearance Map（TCI 通關地圖）

**目的**：建立 TCI 全球通關知識庫，讓業務、PM、Shipping、Customer Service 可快速查詢各國通關難易度、所需文件、Broker 資訊，降低人工作業與知識落差。

**負責人**：Btohri（生管/Shipping 相關）

**目標上線日**：2026-06-25（V1）

---

## 技術架構

```
GitHub Pages（前端）
       ↕ Supabase JS Client
Supabase（PostgreSQL + Auth）
```

### 選型原因

- GitHub Pages：免費、無需後端、部署快速
- Supabase：提供 PostgreSQL + Auth + RLS，不需自建 API
- Vanilla JS：無需建構工具（npm/webpack），直接在瀏覽器執行
- API 呼叫集中於 `api.js`，日後若轉移至 Cloudflare Worker 只需修改此一檔案

### 未來擴充路徑（V2）

```
GitHub Pages → Cloudflare Pages
api.js 呼叫 → Cloudflare Worker（API 層）
Supabase → 保留不動
```

---

## 檔案結構

```
tci-customs-map/
├── index.html          # 首頁（查詢介面）
├── login.html          # 登入頁面
├── admin/
│   └── index.html      # Shipping Team 後台（新增/編輯通關紀錄）
├── js/
│   ├── api.js          # 所有 Supabase 呼叫集中於此（未來轉 Worker 只改這裡）
│   ├── auth.js         # 登入、登出、Session 管理
│   ├── search.js       # 查詢介面邏輯
│   └── admin.js        # 後台邏輯
├── css/
│   └── style.css       # 全站樣式
└── README.md           # 本文件
```

---

## Supabase 設定

### 環境變數（在各 HTML 頁面頂部或 api.js 設定）

```js
const SUPABASE_URL = 'https://xxxx.supabase.co'
const SUPABASE_ANON_KEY = 'your-anon-key'
```

### Auth 設定

- 登入方式：Email + 密碼
- 限制註冊信箱：僅允許 `@tci-bio.com`（於 Supabase Dashboard → Auth → Email 設定 allowed domains）
- Session 保留：預設 1 小時，可延長

---

## 資料庫 Schema（SQL）

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
  issue_supplement boolean default false,   -- 曾補件
  issue_held boolean default false,         -- 曾扣關
  issue_delayed boolean default false,      -- 曾延遲
  issue_note text,                          -- 選填備註
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
```

### RLS（Row Level Security）設定

```sql
-- customs_records：所有登入者可查詢，shipping/admin 可新增編輯
alter table customs_records enable row level security;

create policy "登入者可查詢" on customs_records
  for select using (auth.role() = 'authenticated');

create policy "shipping 可新增" on customs_records
  for insert with check (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('shipping', 'admin')
    )
  );

create policy "shipping 可編輯" on customs_records
  for update using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('shipping', 'admin')
    )
  );
```

---

## 使用者角色

| 角色 | 說明 | 權限 |
|------|------|------|
| user | 一般業務／PM | 查詢、篩選、查看歷史紀錄 |
| shipping | 船務部門 | 新增、編輯通關紀錄，維護燈號 |
| admin | 系統管理員 | 所有權限 + 使用者管理 |

> 角色由 Admin 在 `user_roles` 表手動設定，新註冊預設為 `user`。

---

## 查詢介面（前台）

### 篩選流程

```
選擇國家 → 選擇口岸（動態根據國家載入）→ 選擇劑型 → 顯示結果
```

### 顯示內容

- 風險燈號：🟢 Green / 🟡 Yellow / 🔴 Red
- 平均通關天數
- 所需文件清單
- 建議 Broker
- 異常標籤（曾補件 / 曾扣關 / 曾延遲）
- 備註文字

---

## 後台輸入介面（Shipping Team）

### 新增通關紀錄欄位

| 欄位 | 類型 | 必填 |
|------|------|------|
| 國家 | 下拉選單 | ✅ |
| 口岸 | 下拉選單（動態） | ✅ |
| 劑型 | 下拉選單 | ✅ |
| 通關結果 | 下拉（成功／延遲／扣關／退運） | ✅ |
| 通關天數 | 數字輸入 | ✅ |
| 所需文件 | 文字輸入（逗號分隔） | ✅ |
| 曾補件 | 勾選框 | — |
| 曾扣關 | 勾選框 | — |
| 曾延遲 | 勾選框 | — |
| 備註 | 選填文字 | — |

---

## 風險燈號邏輯

| 燈號 | 條件 |
|------|------|
| 🟢 Green | 有成功案例，無重大異常 |
| 🟡 Yellow | 曾補件 / 曾延遲 / 文件要求多 |
| 🔴 Red | 曾扣關 / 高機率延遲 / 特殊許可需求 |

> V1 由 Shipping team 手動設定風險等級，V2 再改為 AI 自動判斷。

---

## API 呼叫集中點（api.js）

```js
// 所有 Supabase 呼叫統一在此，日後轉 Cloudflare Worker 只改這個檔案

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 查詢通關紀錄
export async function searchCustoms({ country, port, dosageForm }) { ... }

// 新增通關紀錄
export async function addRecord(data) { ... }

// 取得所有國家清單
export async function getCountries() { ... }

// 取得指定國家的口岸清單
export async function getPorts(country) { ... }

// 取得 Broker 清單
export async function getBrokers(country) { ... }
```

---

## 開發順序建議

1. Supabase 建立專案，執行 SQL 建立資料表
2. 建立 `login.html` + `auth.js`，完成登入流程
3. 建立 `api.js`，實作基本查詢函式
4. 建立 `index.html` + `search.js`，完成查詢介面
5. 建立 `admin/index.html` + `admin.js`，完成後台輸入介面
6. 設定 Supabase RLS 權限
7. 部署至 GitHub Pages
8. 測試三種角色的權限是否正確

---

## V2 規劃（參考）

- Cloudflare Worker 取代直接 Supabase 呼叫
- AI 自動判斷風險等級（Azure OpenAI）
- 自然語言搜尋（「印尼 Gummy 好進嗎？」）
- 成分管理、法規限制、國家准入規則

---

## 注意事項

- `SUPABASE_ANON_KEY` 為公開金鑰，可放在前端，但務必設定 RLS
- 勿將 `service_role` key 放在前端任何地方
- 所有寫入操作須驗證使用者角色（透過 RLS + user_roles 表）
- GitHub repo 建議設為 **private**

---

*本文件由 Claude 協助生成，供 TCI 內部開發使用。*

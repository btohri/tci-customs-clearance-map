# TCI Customs Clearance Map — Phase 2：查詢介面 + 後台輸入介面

> 本文件為 Phase 2，請先完成 Phase 1（Supabase 建立 + 登入系統）再進行。
> 將本文件完整交給 GPT，請它依照規格逐一產出程式碼。

---

## 給 GPT 的指令

請依照以下規格，幫我建立 TCI 通關地圖的第二階段：查詢介面與 Shipping Team 後台輸入介面。

要求：
- 純 HTML + Vanilla JS，不使用任何框架或 npm
- Supabase JS Client 透過 CDN 引入
- 所有 Supabase 呼叫集中在 `js/api.js`（Phase 1 已建立，本階段擴充）
- 程式碼需有繁體中文註解
- Phase 1 的 auth.js 與 style.css 繼續沿用

---

## 前置條件

- Phase 1 已完成：Supabase 資料表建立、RLS 設定、登入系統
- `js/api.js` 已有基本 Supabase 連線設定

---

## 檔案結構（Phase 2 新增或修改）

```
tci-customs-map/
├── index.html              # 修改：加入查詢介面
├── js/
│   ├── api.js              # 擴充：加入查詢與新增資料函式
│   ├── auth.js             # 沿用 Phase 1
│   └── search.js           # 新增：查詢介面邏輯
├── admin/
│   ├── index.html          # 新增：後台輸入介面
│   └── js/
│       └── admin.js        # 新增：後台邏輯
└── css/
    └── style.css           # 擴充：加入查詢與後台樣式
```

---

## 查詢介面規格（index.html + search.js）

### 頁面結構

```
頂部導覽列
  └── TCI 通關地圖 Logo
  └── 導覽連結（查詢 / 後台，後台僅 shipping/admin 顯示）
  └── 登入者 Email + 登出按鈕

篩選區塊
  └── 國家下拉選單
  └── 口岸下拉選單（根據國家動態載入）
  └── 劑型下拉選單
  └── 查詢按鈕

結果區塊
  └── 風險燈號
  └── 統計數字（歷史出貨筆數 / 平均通關天數 / 成功率）
  └── 所需文件標籤
  └── 建議 Broker
  └── 異常紀錄標籤（曾補件 / 曾扣關 / 曾延遲）
  └── 備註文字
  └── 歷史紀錄清單（該國+口岸+劑型的所有紀錄，表格呈現）
```

### 查詢流程

1. 頁面載入：呼叫 `requireAuth()`，未登入導向 `login.html`
2. 載入國家清單：從 `customs_records` 取得不重複的國家列表
3. 選擇國家後：動態載入該國口岸清單
4. 點擊查詢按鈕：呼叫 `searchCustoms()` 顯示結果
5. 結果區塊：顯示燈號、統計、文件、Broker、備註

### 劑型選項（固定清單）

```
Capsule / Tablet / Powder / Gummy / Liquid / Softgel / Others
```

### 風險燈號顯示邏輯

- 查詢結果中若有任一筆 `risk_level = 'red'` → 顯示 🔴 Red
- 全部為 `'yellow'` 或混合 yellow/green → 顯示 🟡 Yellow
- 全部為 `'green'` → 顯示 🟢 Green
- 無資料 → 顯示「尚無資料」

### api.js 新增函式

```js
// 取得不重複國家清單
async function getCountries() {
  // select distinct country from customs_records order by country
}

// 取得指定國家的口岸清單
async function getPorts(country) {
  // select distinct port from customs_records where country = $1
}

// 查詢通關紀錄
async function searchCustoms({ country, port, dosageForm }) {
  // select * from customs_records
  // where country = $1 and port = $2 and dosage_form = $3
}

// 取得 Broker 資訊
async function getBrokers(country, port) {
  // select * from broker_directory
  // where country = $1 and (port = $2 or port is null)
}
```

---

## 後台輸入介面規格（admin/index.html + admin.js）

### 存取控制

- 頁面載入時呼叫 `requireShipping()`
- 非 shipping/admin 角色自動導向 `index.html`

### 頁面結構

```
頂部導覽列（同前台）

新增通關紀錄表單
  └── 國家（下拉，可手動新增）
  └── 口岸（下拉，根據國家動態顯示，可手動新增）
  └── 劑型（下拉固定選項）
  └── 通關結果（下拉：成功 / 延遲 / 扣關 / 退運）
  └── 通關天數（數字輸入）
  └── 所需文件（文字輸入，逗號分隔，例：COA, GMP Certificate）
  └── 風險等級（下拉：Green / Yellow / Red）
  └── 建議 Broker（文字輸入）
  └── 異常紀錄（勾選框組）
      ├── □ 曾補件
      ├── □ 曾扣關
      └── □ 曾延遲
  └── 備註（選填文字區塊）
  └── 送出按鈕

歷史紀錄管理表格
  └── 顯示所有通關紀錄
  └── 每筆可編輯 / 刪除
  └── 支援依國家篩選
```

### api.js 新增函式

```js
// 新增通關紀錄
async function addRecord(data) {
  // insert into customs_records (...)
  // created_by = auth.uid()
}

// 更新通關紀錄
async function updateRecord(id, data) {
  // update customs_records set ... where id = $1
}

// 刪除通關紀錄
async function deleteRecord(id) {
  // delete from customs_records where id = $1
}

// 取得所有通關紀錄（後台管理用）
async function getAllRecords() {
  // select * from customs_records order by last_updated desc
}
```

---

## 樣式補充（style.css 擴充）

- 篩選區塊：水平排列三個下拉選單 + 查詢按鈕，手機版改垂直排列
- 結果區塊：白色卡片，頂部顯示風險燈號（大字體），下方統計用 3 欄格線
- 文件標籤：小圓角標籤，灰色背景
- 異常標籤：
  - 曾補件：橘色背景
  - 曾扣關：紅色背景
  - 曾延遲：黃色背景
- 後台表單：每個欄位有 label，垂直排列，最大寬度 600px 置中
- 歷史紀錄表格：條紋底色，hover 高亮，響應式（手機版橫向捲動）

---

## 注意事項

- 國家與口岸下拉選單需支援「手動輸入新值」，因為 Shipping team 可能出貨到尚未有紀錄的國家
- 所需文件欄位以逗號分隔儲存，顯示時拆分為標籤
- 送出表單前需驗證必填欄位（國家、口岸、劑型、通關結果、天數、文件）
- 刪除紀錄前需顯示確認對話框
- 所有操作成功/失敗需顯示提示訊息

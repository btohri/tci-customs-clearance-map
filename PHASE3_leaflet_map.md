# TCI Customs Clearance Map — Phase 3：Leaflet.js 完整世界地圖（V1.5）

> 本文件為 Phase 3，請先完成 Phase 1 與 Phase 2 再進行。
> 將本文件完整交給 GPT，請它依照規格逐一產出程式碼。

---

## 給 GPT 的指令

請依照以下規格，將 TCI 通關地圖的查詢介面從清單模式升級為 Leaflet.js 互動世界地圖。

要求：
- 純 HTML + Vanilla JS，不使用任何框架或 npm
- Leaflet.js 與 GeoJSON 透過 CDN 引入
- 保留 Phase 2 的清單檢視，新增地圖檢視 Tab
- 點擊國家 → 側欄顯示口岸清單 → 選口岸 → 選劑型 → 顯示結果
- 程式碼需有繁體中文註解

---

## 前置條件

- Phase 1 已完成：Supabase 建立、登入系統
- Phase 2 已完成：查詢介面（清單版）、後台輸入介面
- `js/api.js` 已有完整查詢函式

---

## 檔案結構（Phase 3 新增或修改）

```
tci-customs-map/
├── index.html              # 修改：加入地圖 Tab
├── js/
│   ├── api.js              # 沿用 Phase 2
│   ├── auth.js             # 沿用 Phase 1
│   ├── search.js           # 修改：加入地圖模式邏輯
│   └── map.js              # 新增：Leaflet 地圖控制
└── css/
    └── style.css           # 擴充：地圖與側欄樣式
```

---

## CDN 引入（加入 index.html）

```html
<!-- Leaflet CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" />

<!-- Leaflet JS -->
<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
```

### GeoJSON 世界地圖資料來源

```
https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json
```

> 需搭配 TopoJSON 轉換，或改用已轉好的 GeoJSON：
> https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson

建議使用後者（已是標準 GeoJSON，Leaflet 可直接使用）。

---

## 地圖介面規格

### 頁面結構

```
頂部導覽列（同 Phase 2）

Tab 切換列
  ├── 🗺️ 地圖檢視（新增）
  └── 📋 清單檢視（Phase 2 原有）

地圖區塊（地圖檢視 Tab）
  ├── 左側：Leaflet 世界地圖（約 70% 寬度）
  │   └── 國家依風險等級上色
  │   └── 滑鼠 hover 顯示國家名稱 tooltip
  │   └── 點擊國家觸發側欄
  └── 右側：側欄（約 30% 寬度）
      ├── 預設：顯示提示文字「點擊地圖上的國家開始查詢」
      ├── 點擊國家後：顯示該國口岸清單（按鈕形式）
      ├── 選擇口岸後：顯示劑型下拉選單 + 查詢按鈕
      └── 查詢後：顯示結果（同 Phase 2 結果區塊）
```

### 地圖國家上色邏輯

從 Supabase 載入所有國家的風險等級摘要：

```js
// 取得所有國家的最高風險等級
async function getCountryRiskSummary() {
  // select country, risk_level from customs_records
  // 每個國家取最高風險：red > yellow > green
  // 回傳格式：{ 'Indonesia': 'green', 'Japan': 'red', ... }
}
```

上色規則：

| 風險等級 | 填色 | 邊框色 |
|------|------|------|
| 🟢 Green | #E1F5EE | #1D9E75 |
| 🟡 Yellow | #FAEEDA | #EF9F27 |
| 🔴 Red | #FCEBEB | #E24B4A |
| 無資料 | #F1EFE8 | #B4B2A9 |

### 國家名稱對應

GeoJSON 內的國家名稱（英文）需對應到 Supabase 的 `country` 欄位。

建議在 `map.js` 建立一個對應表處理常見差異：

```js
const countryNameMap = {
  'United States of America': 'USA',
  'South Korea': 'Korea',
  'Viet Nam': 'Vietnam',
  // 依實際資料補充
}
```

---

## map.js 需實作的函式

```js
// 初始化 Leaflet 地圖
function initMap() {
  // 建立地圖，設定初始視角（世界全覽）
  // 載入 GeoJSON 世界地圖
  // 依風險等級上色
  // 綁定 hover tooltip
  // 綁定 click 事件觸發側欄
}

// 依風險等級為國家上色
function styleFeature(feature, riskSummary) {
  // 根據 feature.properties.ADMIN 對應 riskSummary
  // 回傳 Leaflet style 物件
}

// 點擊國家後更新側欄
function onCountryClick(countryName) {
  // 呼叫 getPorts(countryName)
  // 在側欄顯示口岸按鈕清單
}

// 選擇口岸後更新側欄
function onPortSelect(country, port) {
  // 在側欄顯示劑型下拉 + 查詢按鈕
}

// 執行查詢並顯示結果
function onSearch(country, port, dosageForm) {
  // 呼叫 searchCustoms()
  // 在側欄顯示結果（風險燈號、統計、文件、Broker）
}

// 重新渲染地圖顏色（新增資料後更新）
async function refreshMapColors() {
  // 重新載入 getCountryRiskSummary()
  // 更新 GeoJSON layer 顏色
}
```

---

## 側欄規格

### 狀態一：預設（未選擇國家）

```
🗺️ 請點擊地圖上的國家開始查詢
（圖示 + 提示文字，置中顯示）
```

### 狀態二：已選擇國家

```
🇮🇩 Indonesia                    [風險燈號]

選擇口岸：
  [Jakarta]  [Surabaya]  [+ 其他]

（口岸按鈕，點擊後進入狀態三）
```

### 狀態三：已選擇口岸

```
🇮🇩 Indonesia > Jakarta          [風險燈號]

選擇劑型：
  [Capsule ▼]

  [查詢]
```

### 狀態四：查詢結果

```
🇮🇩 Indonesia > Jakarta > Capsule

🟢 Green

歷史出貨  平均通關  成功率
   12      5 天     100%

所需文件：
  [COA]  [GMP Certificate]  [BPOM Notification]

建議 Broker：ABC Customs Service

備註：通關穩定，BPOM 備案由客戶端負責。

[← 返回]
```

---

## 樣式補充（style.css 擴充）

```css
/* 地圖容器 */
#map-container {
  display: flex;
  height: calc(100vh - 120px); /* 扣除頂部導覽列高度 */
}

#map {
  width: 70%;
  height: 100%;
}

#map-sidebar {
  width: 30%;
  height: 100%;
  overflow-y: auto;
  padding: 1rem;
  border-left: 1px solid #eee;
}

/* 手機版：地圖全寬，側欄改為底部抽屜 */
@media (max-width: 768px) {
  #map-container { flex-direction: column; }
  #map { width: 100%; height: 50vh; }
  #map-sidebar { width: 100%; height: auto; border-left: none; border-top: 1px solid #eee; }
}
```

---

## 注意事項

- GeoJSON 檔案較大（約 500KB），首次載入需 loading 提示
- 地圖初始化需在 DOM 完全載入後執行（`DOMContentLoaded`）
- Leaflet 地圖容器需有明確高度，否則不會顯示
- 國家名稱對應表需依實際 Supabase 資料中的 country 欄位值調整
- 切換 Tab 時地圖需呼叫 `map.invalidateSize()` 重新計算尺寸，否則會顯示異常
- 地圖點擊與側欄查詢共用 Phase 2 的 `searchCustoms()` 函式，不需重複實作

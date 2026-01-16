# POC Requirements: Dual-Brand Agency Service System

## Overview

A minimal viable product (MVP) for a visa/passport agency service using Google ecosystem.

**Tech Stack:**
- Frontend: Static HTML/CSS/JS (AI-assisted generation)
- Backend: Google Apps Script (GAS)
- Database: Google Sheets
- File Storage: Google Drive
- Forms: Google Forms

---

## System Architecture

```
[Brand Website A] ──┐
                    ├──> [Google Form] ──> [GAS Trigger] ──> [Google Sheets]
[Brand Website B] ──┘                            │
                                                 ├──> [Google Drive] (files)
                                                 ├──> [Gmail] (notifications)
                                                 │
[Order Query Page] ──> [GAS Web App] ──> [Google Sheets] (read only)
                                │
[Admin Website] ──> [GAS Web App] ──> [Google Sheets] (read/write)
                          │
                          ├──> Decrypt sensitive data (on demand)
                          ├──> Update order status ──> [Gmail] (notify customer)
                          └──> View/download files ──> [Google Drive]
```

---

## Deployment Ownership

All resources created under **CLIENT's Google account**:

| Resource            | Owner  | Notes                         |
| ------------------- | ------ | ----------------------------- |
| Google Sheet        | Client | Database for all orders       |
| Google Forms x2     | Client | Immigration + Passport intake |
| Google Drive folder | Client | Uploaded documents storage    |
| GAS project         | Client | All backend code              |
| GAS Web App         | Client | API endpoints (query + admin) |

**Developer access:**
- Temporary collaborator during development
- Full access removed after handover
- No developer credentials remain in system

**Client requirements:**
- Provide a Google account for system deployment
- Recommended: Create dedicated account (e.g., `admin@company.com`)
- Add developer as collaborator during development phase
- Remove developer access after project completion

**Admin authentication:**
- `ADMIN_EMAILS` in Script Properties contains client's Google account(s) only
- Uses `Session.getActiveUser().getEmail()` for verification
- Developer account NOT included in production `ADMIN_EMAILS`

---

## Security Design

### Environment Variables (Script Properties)

Store in `PropertiesService.getScriptProperties()`:

| Key           | Purpose                        |
| ------------- | ------------------------------ |
| `SALT`        | Salt for hash generation       |
| `AES_KEY`     | 256-bit key for AES encryption |
| `ADMIN_EMAIL` | Admin notification recipient   |

### Data Protection Strategy

| Field Type    | Storage Method    | Example Fields                    |
| ------------- | ----------------- | --------------------------------- |
| Public        | Plain text        | Order status, service type        |
| Contact       | Plain text        | Email, phone (admin needs access) |
| Verification  | SHA-256 hash      | `hash(email + salt + order_id)`   |
| Sensitive PII | AES-256 encrypted | ID number, passport number        |
| Order ID      | UUID v4           | Non-sequential, unpredictable     |

### Query Verification Flow

```
User Input: email + order_id
    ↓
GAS calculates: SHA256(email + SALT + order_id)
    ↓
Compare with: verification_hash in Sheet
    ↓
Match → Return order status (non-sensitive fields only)
No Match → Return "Order not found"
```

---

## Google Sheets Structure

### Sheet 1: Immigration Applications (移民申請)

| Column | Field Name                | Type     | Description                            |
| ------ | ------------------------- | -------- | -------------------------------------- |
| A      | order_id                  | UUID     | Primary key, auto-generated            |
| B      | verification_hash         | String   | SHA256(email + salt + order_id)        |
| C      | created_at                | DateTime | Submission timestamp                   |
| D      | updated_at                | DateTime | Last status change                     |
| E      | status                    | Enum     | pending/processing/completed/cancelled |
| F      | service_type              | String   | Service category                       |
| G      | customer_name             | String   | Plain text                             |
| H      | customer_email            | String   | Plain text (admin contact use)         |
| I      | customer_phone            | String   | Plain text                             |
| J      | id_number_encrypted       | String   | AES-256 encrypted                      |
| K      | passport_number_encrypted | String   | AES-256 encrypted                      |
| L      | notes                     | String   | Internal notes                         |
| M      | drive_folder_url          | URL      | Link to uploaded documents             |

### Sheet 2: Passport Applications (護照申請)

Same structure as Sheet 1.

### Sheet 3: Status Options (狀態選項)

| Column | Field Name      |
| ------ | --------------- |
| A      | status_code     |
| B      | status_label_zh |
| C      | status_label_vi |

Values:
- pending | 待處理 | Đang chờ xử lý
- processing | 處理中 | Đang xử lý
- completed | 已完成 | Hoàn thành
- cancelled | 已取消 | Đã hủy

### Sheet 4: System Config (系統設定)

| Key                  | Value        |
| -------------------- | ------------ |
| admin_email          | (configured) |
| notification_enabled | TRUE         |
| max_file_size_mb     | 10           |

---

## Google Forms Design

### Form A: Immigration Service Application

**Fields:**

| Field      | Type        | Required | Validation              |
| ---------- | ----------- | -------- | ----------------------- |
| 姓名       | Short text  | Yes      | -                       |
| Email      | Short text  | Yes      | Email format            |
| 電話       | Short text  | Yes      | -                       |
| 服務類型   | Dropdown    | Yes      | (predefined options)    |
| 身分證字號 | Short text  | Yes      | -                       |
| 護照號碼   | Short text  | No       | -                       |
| 備註       | Long text   | No       | -                       |
| 文件上傳   | File upload | Yes      | PDF, JPG, PNG; max 10MB |

### Form B: Passport Service Application

Similar structure, adjust service types.

---

## Google Apps Script Functions

### 1. Form Submit Trigger

```
Function: onFormSubmit(e)
Trigger: Google Form submission

Steps:
1. Extract form response data
2. Generate UUID for order_id
3. Calculate verification_hash = SHA256(email + SALT + order_id)
4. Encrypt sensitive fields with AES-256
5. Create Drive folder for this application (named by order_id)
6. Move uploaded files to the folder
7. Append row to appropriate Sheet
8. Send confirmation email to customer (include order_id)
9. Send notification email to admin
```

### 2. Order Query Web App

```
Function: doGet(e) / doPost(e)
Deployment: Web App (anyone can access)

Endpoint: GET /query?email={email}&order_id={order_id}

Steps:
1. Receive email + order_id from request
2. Calculate expected_hash = SHA256(email + SALT + order_id)
3. Search Sheets for matching verification_hash
4. If found: return { status, service_type, created_at, updated_at }
5. If not found: return { error: "Order not found" }

Response: JSON only, no sensitive data exposed
```

### 3. Admin Web App

```
Function: doGet(e) / doPost(e) - Admin endpoints
Deployment: Web App (Anyone with Google account)
Execute as: User accessing the app

Authentication:
1. Get current user: Session.getActiveUser().getEmail()
2. Get allowed list: ScriptProperties.getProperty('ADMIN_EMAILS')
3. Check if current user in allowed list
4. Reject with 403 if unauthorized

Endpoints:
GET  ?action=list&status={status}&page={page}
     → Return paginated order list (non-sensitive fields)

GET  ?action=detail&order_id={id}
     → Return full order with decrypted sensitive fields

POST ?action=update&order_id={id}
     Body: { status, notes }
     → Update order, trigger notification email, return success

Response: JSON with appropriate HTTP-like status
```

### 4. Status Update Trigger

```
Function: onEdit(e)
Trigger: Sheet edit (status column change)

Steps:
1. Detect if status column was changed
2. Get customer email from the row
3. Get new status
4. Send status update email to customer
5. Update updated_at timestamp
```

### 5. Encryption Utilities

```
Library: CryptoJS (copy source into GAS project)

Function: encrypt(plaintext)
- Get key from Script Properties: PropertiesService.getScriptProperties().getProperty('AES_KEY')
- Use CryptoJS.AES.encrypt(plaintext, key).toString()
- Mode: AES-256-CBC (CryptoJS default, passphrase mode)
- Output: Base64 string (starts with "U2FsdGVkX1..." which is "Salted__" encoded)
- CryptoJS auto-generates salt internally

Function: decrypt(ciphertext)
- Get key from Script Properties
- Use CryptoJS.AES.decrypt(ciphertext, key).toString(CryptoJS.enc.Utf8)
- Return plaintext string

Function: hashForVerification(email, orderId)
- Get salt from Script Properties: PropertiesService.getScriptProperties().getProperty('SALT')
- Concatenate: email + salt + orderId
- Use CryptoJS.SHA256(concatenated).toString()
- Return hex string

IMPORTANT:
- Never hardcode keys in source code
- All secrets stored in Script Properties
- POC uses CBC mode; evaluate GCM upgrade before production
```

### 6. UUID Generator

```
Function: generateUUID()
- Return UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
- Used for order_id
```

---

## Frontend Pages

### Page 1 & 2: Brand Websites (Static)

**Structure:**
```
index.html
├── Header (logo, navigation)
├── Hero section (main message)
├── Services section (service list)
├── Process section (how it works)
├── Contact section (phone, address, hours)
├── Embedded Google Form (iframe)
└── Footer (copyright, links)
```

**Requirements:**
- Responsive design (mobile-first)
- Fast loading (static HTML/CSS)
- FB Pixel integration
- Basic SEO meta tags

### Page 3: Order Query Page

**Structure:**
```
query.html
├── Header (logo)
├── Query form
│   ├── Email input
│   ├── Order ID input
│   └── Submit button
├── Result display area
│   ├── Loading state
│   ├── Success: show order status
│   └── Error: show "not found" message
└── Footer
```

**Behavior:**
```javascript
// Pseudocode
async function queryOrder(email, orderId) {
    const response = await fetch(GAS_WEB_APP_URL + '?email=' + email + '&order_id=' + orderId);
    const data = await response.json();
    
    if (data.error) {
        showError(data.error);
    } else {
        showResult(data);
    }
}
```

### Page 4: Admin Website

**Access Control:**
- Requires Google account login
- Only accounts listed in `ADMIN_EMAILS` can access
- Unauthorized users see "Access Denied" message

**Structure:**
```
admin.html
├── Header (logo, logout)
├── Authentication check (on load)
├── Dashboard
│   ├── Summary stats (pending/processing/completed counts)
│   └── Quick filters
├── Order list
│   ├── Filter by: status, service type, date range
│   ├── Search by: email, order ID, customer name
│   └── Sortable columns
├── Order detail modal
│   ├── Customer info (decrypted on demand)
│   ├── Order status dropdown (update triggers email)
│   ├── Uploaded files list (links to Drive)
│   ├── Internal notes field
│   └── Action buttons (save, cancel)
└── Footer
```

**Key Functions:**

| Function      | Description                                 |
| ------------- | ------------------------------------------- |
| List orders   | Paginated, filterable order list            |
| View order    | Show full details, decrypt sensitive fields |
| Update status | Change status, auto-notify customer         |
| Add notes     | Internal notes for staff                    |
| View files    | Link to Drive folder                        |

**GAS Endpoint (Admin):**
```
GET  /admin/orders         - List all orders (with filters)
GET  /admin/orders/{id}    - Get single order (decrypted)
POST /admin/orders/{id}    - Update order (status, notes)
```

**Authentication Flow:**
```
1. User opens Admin Website
2. Page calls GAS Web App with credentials
3. GAS checks Session.getActiveUser().getEmail()
4. If email in ADMIN_EMAILS → return data
5. If not → return 403 Unauthorized
```

---

## Email Templates

### Template 1: Order Confirmation (to Customer)

```
Subject: 【訂單確認】您的申請已收到 - 訂單編號 {order_id}

{customer_name} 您好，

感謝您使用我們的服務，您的申請已成功送出。

訂單編號：{order_id}
服務類型：{service_type}
申請時間：{created_at}

請保留此訂單編號，您可以在我們的網站查詢申請進度。
查詢網址：{query_page_url}

如有任何問題，請聯繫我們：
電話：{company_phone}
Email：{company_email}

此為系統自動發送，請勿直接回覆。
```

### Template 2: Status Update (to Customer)

```
Subject: 【進度更新】您的申請狀態已更新 - 訂單編號 {order_id}

{customer_name} 您好，

您的申請進度已更新：

訂單編號：{order_id}
目前狀態：{new_status}
更新時間：{updated_at}

查詢詳情：{query_page_url}

如有任何問題，請聯繫我們。
```

### Template 3: New Order Alert (to Admin)

```
Subject: 【新訂單】{service_type} - {customer_name}

新的申請已收到：

訂單編號：{order_id}
服務類型：{service_type}
客戶姓名：{customer_name}
客戶Email：{customer_email}
客戶電話：{customer_phone}
申請時間：{created_at}

文件資料夾：{drive_folder_url}

請至後台處理。
```

---

## File Organization (Google Drive)

```
Agency Documents/
├── Immigration/
│   ├── {order_id_1}/
│   │   ├── uploaded_file_1.pdf
│   │   └── uploaded_file_2.jpg
│   └── {order_id_2}/
│       └── ...
└── Passport/
    ├── {order_id_3}/
    └── ...
```

**Naming Convention:**
- Folder name: order_id (UUID)
- No PII in folder/file names
- Original filenames preserved inside folder

---

## Deployment Checklist

### Google Cloud / Workspace Setup

- [ ] Create or use existing Google Workspace account
- [ ] Create Google Sheet (copy template)
- [ ] Create Google Forms x2
- [ ] Create Google Drive folder structure
- [ ] Deploy GAS as Web App
- [ ] Set up form submit triggers
- [ ] Set up sheet edit triggers
- [ ] Configure Script Properties (SALT, AES_KEY, ADMIN_EMAIL)

### Frontend Deployment

- [ ] Generate static HTML for brand sites
- [ ] Generate query page
- [ ] Embed Google Forms
- [ ] Add FB Pixel code
- [ ] Deploy to GitHub Pages / Cloudflare Pages
- [ ] Configure custom domain (if provided by client)

### Testing

- [ ] Submit test form → verify Sheet data
- [ ] Verify encryption/decryption works
- [ ] Test order query with valid credentials
- [ ] Test order query with invalid credentials
- [ ] Verify email notifications sent
- [ ] Test status update trigger
- [ ] Test on mobile devices

---

## Out of Scope (Explicit Exclusions)

- User registration / login system
- Custom admin dashboard UI
- Mobile app
- Multi-language support (unless client provides translations)
- Logo design / brand identity design
- Ongoing maintenance (separate contract)
- Payment integration

---

## Risk Considerations

| Risk                                 | Mitigation                                  |
| ------------------------------------ | ------------------------------------------- |
| GAS execution time limit (6 min)     | Keep operations simple, no batch processing |
| Sheet concurrent write issues        | Low volume expected, acceptable risk        |
| AES library compatibility            | Test CryptoJS in GAS environment first      |
| Google Form customization limits     | Accept default styling, embed cleanly       |
| Client provides incomplete materials | Block start until materials received        |

---

## POC Success Criteria

Before presenting to client, verify:

1. [ ] Form submission creates encrypted record in Sheet
2. [ ] Order query returns correct status with valid credentials
3. [ ] Order query rejects invalid credentials
4. [ ] Email notifications work (confirmation + status update)
5. [ ] Files upload to correct Drive folder
6. [ ] Static pages render correctly on mobile

---

## Notes for Implementation

1. **Start with GAS backend first** - this is the core logic
2. **Test encryption/decryption early** - if CryptoJS doesn't work in GAS, need Plan B
3. **Use Script Properties for all secrets** - never hardcode
4. **Keep Sheet structure simple** - easier for client to understand as "admin panel"
5. **Document the query URL** - client needs this for their reference

---

## Reference: GAS CryptoJS Implementation

### Setup Steps

1. Download CryptoJS from: https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js
2. Create new script file in GAS project: `CryptoJS.gs`
3. Paste entire CryptoJS source into that file
4. CryptoJS object becomes globally available

### Usage Example

```javascript
// Encrypt sensitive data before storing
function encryptData(plaintext) {
  var key = PropertiesService.getScriptProperties().getProperty('AES_KEY');
  return CryptoJS.AES.encrypt(plaintext, key).toString();
}

// Decrypt when admin needs to view
function decryptData(ciphertext) {
  var key = PropertiesService.getScriptProperties().getProperty('AES_KEY');
  return CryptoJS.AES.decrypt(ciphertext, key).toString(CryptoJS.enc.Utf8);
}

// Generate verification hash for order query
function generateVerificationHash(email, orderId) {
  var salt = PropertiesService.getScriptProperties().getProperty('SALT');
  var combined = email + salt + orderId;
  return CryptoJS.SHA256(combined).toString();
}
```

### Script Properties Setup

In GAS Editor: Project Settings > Script Properties > Add:

| Property     | Value                                   | Description                 |
| ------------ | --------------------------------------- | --------------------------- |
| AES_KEY      | (generate strong passphrase, 32+ chars) | Encryption key              |
| SALT         | (generate random string, 16+ chars)     | Hash salt                   |
| ADMIN_EMAILS | client@example.com                      | Comma-separated if multiple |

Note: ADMIN_EMAILS should contain CLIENT's accounts only, not developer's.

### Encryption Mode

- POC: AES-256-CBC (CryptoJS passphrase mode default)
- Production consideration: Evaluate AES-GCM for authenticated encryption

---

End of Requirements Document
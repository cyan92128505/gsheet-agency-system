# Dual-Brand Agency Service System

A lightweight order management system for visa/passport agency services, built entirely on Google ecosystem.

## Overview

This system provides:
- Two brand websites (Immigration Service + Passport Service)
- Online application forms with file upload
- Order status tracking for customers
- Admin dashboard for order management
- Automated email notifications

## Tech Stack

| Layer        | Technology         | Cost                |
| ------------ | ------------------ | ------------------- |
| Frontend     | Static HTML/CSS/JS | Free (GitHub Pages) |
| Forms        | Google Forms       | Free                |
| Backend      | Google Apps Script | Free                |
| Database     | Google Sheets      | Free                |
| File Storage | Google Drive       | Free (15GB)         |
| Email        | Gmail (via GAS)    | Free                |

**Total hosting cost: $0/month** (within free tier limits)

## Architecture

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

## Security Features

- **AES-256 Encryption**: Sensitive PII (ID numbers, passport numbers) encrypted at rest
- **SHA-256 Hashing**: Order query verification using salted hash
- **Google Authentication**: Admin access restricted to specific Google accounts
- **No Plain Secrets**: All keys stored in GAS Script Properties

## Project Structure

```
/
├── README.md                 # This file
├── claude.md                 # Detailed requirements specification
├── gas/                      # Google Apps Script files
│   ├── Main.gs               # Entry points (doGet, doPost)
│   ├── FormHandler.gs        # Form submission processing
│   ├── QueryHandler.gs       # Order query endpoint
│   ├── AdminHandler.gs       # Admin API endpoints
│   ├── Crypto.gs             # Encryption/hashing utilities
│   ├── Email.gs              # Email notification functions
│   ├── Utils.gs              # UUID, helpers
│   └── CryptoJS.gs           # CryptoJS library (copy from CDN)
├── frontend/                 # Static frontend files
│   ├── brand-a/              # Immigration service website
│   │   └── index.html
│   ├── brand-b/              # Passport service website
│   │   └── index.html
│   ├── query/                # Order query page
│   │   └── index.html
│   └── admin/                # Admin dashboard
│       └── index.html
└── docs/                     # Documentation
    ├── deployment-guide.md   # Step-by-step deployment
    └── user-manual.md        # Client operation guide
```

## Quick Start (Development)

### Prerequisites

- Google account (for development)
- Client's Google account (for deployment)
- Basic knowledge of Google Apps Script

### Step 1: Set up Google Sheet

1. Create new Google Sheet
2. Create sheets: `移民申請`, `護照申請`, `狀態選項`, `系統設定`
3. Set up column headers per requirements spec

### Step 2: Set up Google Apps Script

1. Open Sheet > Extensions > Apps Script
2. Create script files per project structure
3. Copy CryptoJS library into `CryptoJS.gs`
4. Configure Script Properties:
   - `AES_KEY`: Generate 32+ character passphrase
   - `SALT`: Generate 16+ character random string
   - `ADMIN_EMAILS`: Client's Google account

### Step 3: Set up Google Forms

1. Create Immigration Service form
2. Create Passport Service form
3. Link forms to respective sheets
4. Set up form submit triggers

### Step 4: Deploy Web App

1. Deploy GAS as Web App
2. Set "Execute as: User accessing"
3. Set "Who has access: Anyone with Google account"
4. Note the Web App URL

### Step 5: Deploy Frontend

1. Update frontend files with Web App URL
2. Deploy to GitHub Pages or Cloudflare Pages
3. Configure custom domain (if applicable)

## Configuration

### Script Properties

| Key            | Description               | Example                             |
| -------------- | ------------------------- | ----------------------------------- |
| `AES_KEY`      | Encryption passphrase     | `MySecure32CharacterPassphrase!!`   |
| `SALT`         | Hash salt                 | `RandomSalt16Char`                  |
| `ADMIN_EMAILS` | Authorized admin accounts | `admin@client.com,staff@client.com` |

### Environment

All configuration stored in GAS Script Properties. No hardcoded secrets in source code.

## API Endpoints

### Order Query (Public)

```
GET {WEB_APP_URL}?action=query&email={email}&order_id={order_id}

Response (success):
{
  "success": true,
  "order": {
    "order_id": "uuid",
    "status": "processing",
    "service_type": "Immigration",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-02T00:00:00Z"
  }
}

Response (not found):
{
  "success": false,
  "error": "Order not found"
}
```

### Admin API (Authenticated)

```
GET {WEB_APP_URL}?action=admin_list&status={status}&page={page}
GET {WEB_APP_URL}?action=admin_detail&order_id={id}
POST {WEB_APP_URL}?action=admin_update&order_id={id}
     Body: { "status": "completed", "notes": "..." }
```

## Limitations

- **GAS Execution Time**: 6 minutes max per request
- **Concurrent Writes**: Google Sheets not designed for high concurrency
- **Daily Quotas**: GAS has daily execution limits (sufficient for small business)
- **File Size**: Google Drive file upload limits apply

## Handover Checklist

After development complete:

- [ ] All resources under client's Google account
- [ ] Developer access removed from Sheet/Drive
- [ ] Developer email removed from ADMIN_EMAILS
- [ ] Client trained on admin operations
- [ ] User manual delivered
- [ ] Deployment guide delivered
- [ ] Source code repository transferred (if applicable)

## License

Private project. All rights reserved by client after handover.

## Support

Post-handover support available under separate maintenance contract.
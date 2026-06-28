# Hướng dẫn chạy chương trình

Tài liệu này cung cấp hướng dẫn chi tiết để chạy dự án **SEQMS Admin Kiosk** gồm frontend (React + Vite) và backend (Node.js + Express + NeonDB).
https://seqms-admin-kiosk.vercel.app/#/
**Admin mặc định:**
- Username: `admin`
- Password: `123123`
**User mặc định**
- Username: `user`
- Password: `123123`
---

## 1. Yêu cầu môi trường

Trước khi bắt đầu, đảm bảo máy của bạn đã cài đặt:

| Thành phần | Phiên bản tối thiểu | Ghi chú |
|-----------|-------------------|---------|
| **Node.js** | 18.x trở lên | Kiểm tra: `node -v` |
| **npm** | 9.x trở lên | Kiểm tra: `npm -v` |
| **Git** | Tùy chọn | Để clone repo |
| **Trình duyệt** | Chrome, Edge, Firefox | Phiên bản mới nhất khuyến nghị |

> **Không cần:** PostgreSQL local (dùng NeonDB cloud thay thế)

### 1.1 Cài đặt Node.js

**Trên Windows:**
- Tải Node.js từ: https://nodejs.org

**Trên macOS:**
```bash
brew install node
```

**Trên Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install nodejs npm
```

---

## 2. Cách cài đặt dự án

### 2.1 Clone project

```bash
# Nếu dùng Git
git clone <repo-url>
cd seqms-admin-kiosk

# Hoặc download file zip → giải nén
```

### 2.2 Cài đặt dependencies cho frontend

```bash
# Di chuyển tới thư mục gốc dự án
cd seqms-admin-kiosk

# Cài đặt các package
npm install
```

### 2.3 Cài đặt dependencies cho backend

```bash
# Di chuyển tới thư mục backend
cd backend

# Cài đặt các package
npm install
```

### 2.4 Cấu hình file `.env` cho backend

Trong thư mục `backend/`, tạo file `.env` (hoặc copy từ `.env.example`):

```bash
# Windows (Command Prompt)
copy .env.example .env

# macOS/Linux
cp .env.example .env
```

**Cập nhật nội dung file `.env` với credentials NeonDB:**

```env
PORT=5000
DB_HOST=ep-nameless-pine-amcev8gg-pooler.c-5.us-east-1.aws.neon.tech
DB_PORT=5432
DB_NAME=neondb
DB_USER=neondb_owner
DB_PASSWORD=npg_aLbB4cR8iMms
JWT_SECRET=your_super_secret_jwt_key_here_123456789
NODE_ENV=development
```

## 3. Cách khởi chạy dự án

Bạn cần mở **2 terminal riêng biệt** để chạy backend và frontend.

### 3.1 Chạy backend

**Terminal 1:**
```bash
cd e:\seqms-admin-kiosk\backend
npm run dev
```

**Kết quả mong đợi:**
```
✅ PostgreSQL connected successfully
✅ Database models synced
[nodemon] starting `node src/server.js`
Server is running on port 5000
```

Backend API sẽ chạy tại: **`http://localhost:5000/api`**

### 3.2 Chạy frontend

**Terminal 2:**
```bash
cd seqms-admin-kiosk
npm run dev
```

**Kết quả mong đợi:**
```
Local:   http://localhost:5173/
```

Frontend sẽ chạy tại: **`http://localhost:5173`**

---
## 4. Tài khoản đăng nhập mặc định
**Admin mặc định:**
- Username: `admin`
- Password: `123123`
**User mặc định**
- Username: `user`
- Password: `123123`
---

## 5. Cấu trúc thư mục

```text
seqms-admin-kiosk/
│
│
├── components/                   # Các component React dùng chung
│   ├── AddServiceModal.tsx       # Modal thêm dịch vụ
│   ├── CancelTicketModal.tsx     # Modal hủy vé
│   ├── FormViewerModal.tsx       # Viewer biểu mẫu
│   ├── HeaderBoard.tsx           # Header giao diện
│   ├── MediaContainer.tsx        # Container media
│   ├── PrivateRoute.tsx          # Kiểm tra quyền truy cập
│   ├── Sidebar.tsx               # Thanh bên
│   ├── TicketCallPopup.tsx       # Popup gọi vé
│   └── UIComponents.tsx          # Các component UI khác
│
├── pages/                        # Các trang chính của ứng dụng
│   ├── Login.tsx                 # Trang đăng nhập
│   ├── Dashboard.tsx             # Bảng điều khiển chính
│   ├── CounterLive.tsx           # Quán lý quầy phục vụ trực tiếp
│   ├── MonitorLive.tsx           # Giám sát trực tiếp
│   ├── BoardDisplayPage.tsx      # Hiển thị bảng thông tin
│   ├── ServiceManager.tsx        # Quản lý dịch vụ
│   ├── UserManager.tsx           # Quản lý người dùng
│   ├── CounterConfig.tsx         # Cấu hình quầy
│   ├── DeviceManager.tsx         # Quản lý thiết bị
│   ├── PGDManager.tsx            # Quản lý PGD
│   └── Reports.tsx               # Báo cáo
│
├── services/                     # Các service API
│   └── api.ts                    # Axios client gọi backend (localhost:5000)
│
├── hooks/                        # Custom React hooks
│   └── useTextToSpeech.ts        # Hook text-to-speech
│
├── constants/                    # Dữ liệu hằng số
│   ├── menu.ts                   # Cấu hình menu
│
├── assets/                       # Hình ảnh, icon
├── App.tsx                       # Component gốc
├── index.tsx                     # Entry point React
├── index.html                    # HTML template
├── vite.config.ts                # Cấu hình Vite
├── tsconfig.json                 # Cấu hình TypeScript
└── package.json                  # Dependencies frontend

backend/
│
├── src/
│   ├── server.js                 # Điểm vào backend
│   ├── app.js                    # Cấu hình Express app
│   │
│   ├── config/
│   │   └── db.js                 # Kết nối + sync PostgreSQL
│   │
│   ├── models/                   # Data models (Sequelize ORM)
│   │   ├── User.js               # Model User
│   │   ├── init-models.js        # Khởi tạo models
│   │   └── ...
│   │
│   ├── controllers/              # Xử lý request/response
│   │   ├── auth.controller.js    # Login, logout
│   │   ├── user.controller.js    # CRUD user
│   │   ├── kiosk.controller.js   # Quản lý kiosk
│   │   ├── dashboard.controller.js # Dashboard
│   │   └── ...
│   │
│   ├── services/                 # Business logic
│   │   ├── auth.service.js       # Xác thực
│   │   ├── user.service.js       # Xử lý user
│   │   └── ...
│   │
│   ├── routes/                   # Định tuyến API
│   │   ├── index.js              # Tuyến chính
│   │   ├── auth.routes.js        # POST /api/auth/login
│   │   ├── user.routes.js        # CRUD /api/users
│   │   └── ...
│   │
│   ├── middlewares/              # Middleware Express
│   │   ├── auth.middleware.js    # JWT verification
│   │   ├── error.middleware.js   # Xử lý lỗi
│   │   └── ...
│   │
│   ├── utils/                    # Tiện ích
│   │   ├── jwt.js                # Tạo/xác thực JWT
│   │   ├── response.js           # Format response
│   │   └── ...
│   │
│   ├── socket/                   # WebSocket (Socket.io)
│   ├── uploads/                  # Thư mục upload file
│   └── html/                     # Template HTML (biểu mẫu)
│
├── package.json                  # Dependencies backend
├── .env.example                  # Template file .env
└── .gitignore
```

**Chức năng chính:**

| Thành phần | Chức năng |
|-----------|----------|
| **Login** | Xác thực người dùng, cấp JWT token |
| **Dashboard** | Tổng quan dữ liệu, thống kê hệ thống |
| **Counter Live** | Quản lý quầy phục vụ trực tiếp, gọi vé |
| **Monitor Live** | Giám sát hoạt động các quầy |
| **Service Manager** | Quản lý các dịch vụ |
| **User Manager** | Quản lý tài khoản người dùng |
| **Reports** | Báo cáo, xuất file |

---

## 6. Chia sẻ dữ liệu giữa các máy

Vì dùng **NeonDB (Cloud Database)**, dữ liệu tự động đồng bộ trên tất cả máy:

### Máy khác chỉ cần:
1. Copy file `.env` (hoặc tạo mới từ `.env.example`)
2. Điền credentials NeonDB giống vào `.env`
3. Chạy `npm install` → `npm run dev`

**Không cần:**
- Tạo database
- pg_dump/restore
- PostgreSQL local


---
## 7. Xử lý sự cố thường gặp

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-----------|----------|
| `Port 5000 already in use` | Port đã được dùng | Thay `PORT` trong `.env` |
| `connection is insecure` | NeonDB yêu cầu SSL | Check `dialectOptions` trong `db.js` |
| `NeonDB not found` hoặc timeout | Credentials sai | Kiểm tra lại `.env` |
| `DB_HOST không resolve` | Network/DNS issue | Ping host, kiểm tra internet |
| `ENOENT: no such file .env` | Thiếu file `.env` | Copy từ `.env.example` |
| `Invalid token` | JWT hết hạn | Đăng nhập lại |

### Fix lỗi SSL NeonDB:

Nếu lỗi `connection is insecure`, kiểm tra `backend/src/config/db.js`:

```javascript
dialectOptions: {
    ssl: {
        require: true,
        rejectUnauthorized: false,
    },
}
```
---

**Chúc bạn chạy dự án thành công! 🎉**

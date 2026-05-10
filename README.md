# Website Chatting - Backend API & Security

**Database:** `btvn01_mongodb` (MongoDB Local: `mongodb://localhost:27017/btvn01_mongodb`)

## 📋 Chức năng đã triển khai

### 1️⃣ Authentication & Security - Login API (Vũ Minh Khang - 23110238)
- 04 Lớp bảo mật API (Rate Limiting, Input Validation, JWT, Authorization)
- JWT: Access Token 15p & Refresh Token 7 ngày
- Phân quyền Admin (R1) và User (R2)
- Pages: Login, User Profile, Admin Profile
- Endpoints: `/api/login`, `/api/refresh-token`, `/api/logout`, `/user/profile`, `/admin/profile`

### 2️⃣ User Registration - (Bùi Thanh Tùng)
- Đăng ký người dùng với validation
- OTP verification
- Pages: Register, Verify OTP

### 3️⃣ Forgot Password & Reset Password - (PhucTien2103)
- Quên mật khẩu với OTP xác thực
- Đặt lại mật khẩu
- Pages: Forgot Password, Reset Password

---

## 🚀 Hướng dẫn chạy ứng dụng

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Khởi động MongoDB
- Cài MongoDB từ [mongodb.com](https://www.mongodb.com/try/download/community)
- Khởi động service: `net start MongoDB` (Windows)
- Hoặc dùng MongoDB Compass GUI

### 3. Chạy ứng dụng
```bash
npm start
```
- Server chạy tại: `http://localhost:8088`
- **Lần đầu chạy:** Tự động tạo 2 tài khoản mẫu

---

## 🧪 Thông tin tài khoản test

### Admin Account (Quyền R1)
```
Email: admin@chatapp.com
Password: Admin@123
Role: Admin
URL: http://localhost:8088/login-page
```

### User Account (Quyền R2)
```
Email: user@chatapp.com
Password: User@123
Role: User
URL: http://localhost:8088/login-page
```

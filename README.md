# Website Chatting - Backend API & Security

Database name: `btvn01_mongodb`
Connection String: `mongodb://localhost:27017/btvn01_mongodb`

## Chức năng đã triển khai

### Authentication & Security - Login API (Thành viên: Vũ Minh Khang - 23110238)
*Đã triển khai 04 Lớp bảo mật API & Kiến trúc 3 tầng*

**Các trang UI (Glassmorphism & Light Theme):**
Trang Đăng nhập: http://localhost:8088/login-page

**Các API Endpoints:**
- `POST /api/login` - Đăng nhập (có Rate Limit & Validation)
- `POST /api/refresh-token` - Cấp lại Access Token khi hết hạn
- `POST /api/logout` - Đăng xuất
- `GET /user/profile` - Xem thông tin (Cần Access Token & Quyền R1/R2)
- `GET /admin/profile` - Xem thông tin Admin (Cần Access Token & Quyền R1)

**Công nghệ bảo mật sử dụng:**
1. **Lớp 1 (Rate Limiting):** Chống Brute-force/Spam API.
2. **Lớp 2 (Input Validation):** Kiểm tra dữ liệu đầu vào.
3. **Lớp 3 (Authentication):** JWT (Access Token 15p & Refresh Token 7 ngày).
4. **Lớp 4 (Authorization):** Phân quyền Admin (R1) và User (R2).

---
Ảnh kết quả trong MongoDB: `/screenshots/mongodb_compass_result.jpg`

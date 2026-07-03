# Website Chatting - Backend API

Đây là backend chính của hệ thống thương mại điện tử `website-chatting`. Service này cung cấp REST API, xác thực JWT, phân quyền theo vai trò, kết nối MongoDB, xử lý giỏ hàng/đơn hàng/thanh toán, quản trị sản phẩm, voucher, dashboard, chat realtime, livestream, kiểm duyệt live chat, QR xác minh giao hàng và tích hợp AI risk service.

Backend được dùng chung bởi:

- `website-chatting-FE`: giao diện khách hàng.
- `website-chatting-ADMIN`: cổng admin/manager/shipper.
- `ai-risk-service`: service AI đánh giá rủi ro đơn hàng hoặc kiểm duyệt nội dung, gọi qua URL cấu hình trong `.env`.

Mặc định backend chạy tại:

```text
http://localhost:8088
```

API nghiệp vụ chính nằm dưới prefix:

```text
/api
```

Một số route profile cũ vẫn giữ dạng:

```text
/user/profile
/admin/profile
/manager/profile
/shipper/profile
```

## 1. Công Nghệ Sử Dụng

- Node.js.
- Express 5.
- MongoDB và Mongoose.
- JWT access token, refresh token và token tạm cho OTP/reset password.
- BcryptJS để hash mật khẩu.
- Socket.io cho notification, chat và livestream realtime.
- Nodemailer để gửi OTP/email.
- VNPAY SDK cho thanh toán online.
- Express Validator để validate request.
- Express Rate Limit để chống spam ở các API nhạy cảm.
- Axios để gọi service ngoài, ví dụ AI risk service.
- Babel Node và Nodemon cho môi trường phát triển.
- Mocha, Chai, Supertest cho test backend theo script cấu hình.

## 2. Vai Trò Trong Hệ Thống

| Role | Tên | Repo sử dụng chính | Quyền chính |
| --- | --- | --- | --- |
| `R1` | Admin | `website-chatting-ADMIN` | Toàn quyền quản trị |
| `R2` | Customer/User | `website-chatting-FE` | Mua hàng, chat, xem live, review |
| `R3` | Manager | `website-chatting-ADMIN` | Quản lý nghiệp vụ theo quyền backend |
| `R4` | Shipper | `website-chatting-ADMIN` | Xác minh giao hàng bằng QR |

Middleware phân quyền chính nằm ở:

```text
src/middleware/loginMiddleware.js
```

## 3. Chức Năng Chính

### Xác thực và tài khoản

- Đăng ký tài khoản.
- Gửi và xác thực OTP.
- Đăng nhập.
- Đăng xuất.
- Refresh access token.
- Quên mật khẩu.
- Đặt lại mật khẩu.
- Đổi mật khẩu.
- Lấy hồ sơ theo role: customer, admin, manager, shipper.

### Sản phẩm và bài viết

- Trang chủ sản phẩm.
- Tìm kiếm sản phẩm.
- Lọc theo danh mục, giá, trạng thái.
- Xem chi tiết sản phẩm theo slug.
- Sản phẩm bán chạy, xem nhiều.
- Sản phẩm yêu thích.
- Sản phẩm đã xem gần đây.
- Admin/manager thêm, sửa, ẩn/xóa sản phẩm theo quyền.
- Bài viết trang chủ và chi tiết bài viết.
- Admin tạo bài viết.

### Giỏ hàng, đơn hàng và thanh toán

- Xem giỏ hàng hiện tại.
- Thêm sản phẩm vào giỏ.
- Cập nhật số lượng.
- Xóa sản phẩm hoặc xóa toàn bộ giỏ.
- Preview checkout, tính voucher/giảm giá trước khi đặt.
- Đặt hàng.
- Thanh toán COD.
- Thanh toán VNPAY.
- VNPAY return và IPN.
- Thanh toán lại đơn VNPAY.
- Xem đơn hàng của khách.
- Hủy đơn hoặc gửi yêu cầu hủy.
- Admin/manager xem danh sách đơn, chi tiết đơn, cập nhật trạng thái.
- Tạo QR giao hàng.
- Shipper/customer xác minh giao hàng bằng QR.

### Voucher, loyalty và ví giao dịch

- Admin/manager tạo, xem, sửa, xóa voucher.
- Khách hàng xem voucher khả dụng.
- Tính điểm loyalty.
- Lưu lịch sử wallet transaction.

### Review và thông báo

- Khách hàng xem review sản phẩm.
- Khách hàng tạo review.
- Backend tạo notification cho các sự kiện quan trọng.
- API lấy danh sách notification.
- Đánh dấu đã đọc một notification hoặc tất cả.
- Socket.io đẩy notification realtime.

### Chat, livestream và kiểm duyệt

- Chat hỗ trợ giữa khách hàng và staff.
- Lấy lịch sử chat.
- Lấy danh sách contact chat.
- Đánh dấu tin nhắn đã đọc.
- Admin bắt đầu/kết thúc livestream.
- Người dùng/nhân viên xem livestream.
- Live chat trong livestream.
- Xóa/ghim tin nhắn live chat.
- Cảnh cáo/cấm người dùng trong live chat.
- Xem danh sách ban và xử lý yêu cầu mở cấm.

### AI risk service

- Gọi AI service qua `AI_RISK_SERVICE_URL` hoặc `AI_SERVICE_URL`.
- Có timeout qua `AI_RISK_TIMEOUT_MS`.
- Có chế độ `RISK_ENGINE_MODE`, ví dụ `AI_FIRST`.
- Nếu service AI không chạy, backend vẫn cần được cấu hình phù hợp để tránh ảnh hưởng demo các phần không dùng AI.

## 4. Cấu Trúc Thư Mục

```text
website-chatting/
  src/
    config/          Kết nối MongoDB và cấu hình Socket.io
    controllers/     Controller xử lý request/response
    middleware/      Auth, role guard, validator, rate limit
    models/          Mongoose models
    route/           Khai báo REST routes
    seed/            Seed admin và import bài viết ban đầu
    services/        Business logic
    sockets/         Socket.io handlers cho chat/livestream
    utils/           JWT, email, notification, response helper
    validators/      Validator riêng cho profile
  scripts/           Smoke test và script migrate
  postman/           Postman collections hỗ trợ kiểm thử
  package.json
  .env.example
```

Các model chính:

```text
user.js
product.model.js
cart.model.js
order.model.js
voucher.model.js
review.model.js
notification.model.js
chatMessage.model.js
livestream.model.js
liveChatMessage.model.js
liveChatModerationCase.model.js
liveChatUnbanRequest.model.js
systemSetting.model.js
walletTransaction.model.js
otp.model.js
refreshToken.model.js
article.model.js
```

## 5. Yêu Cầu Trước Khi Chạy

- Node.js 18 trở lên.
- npm.
- MongoDB local hoặc MongoDB Atlas.
- Tài khoản email/app password nếu cần gửi OTP.
- VNPAY sandbox credentials nếu test thanh toán VNPAY.
- `ai-risk-service` nếu muốn test phần AI.

Kiểm tra Node/npm:

```bash
node -v
npm -v
```

## 6. Cài Đặt

Từ thư mục chứa toàn bộ đồ án:

```bash
cd website-chatting
npm install
```

## 7. Cấu Hình `.env`

Repo có file `.env.example`. Tạo file `.env`:

```bash
cp .env.example .env
```

Nếu dùng PowerShell trên Windows:

```powershell
Copy-Item .env.example .env
```

Cấu hình tối thiểu để chạy local:

```env
NODE_ENV=development
PORT=8088
SEED_INITIAL_DATA=true
MONGO_DB_URL=mongodb://127.0.0.1:27017/website-chatting
JWT_SECRET=your_access_token_secret
JWT_EXPIRE=1h
JWT_TEMP_SECRET=your_temp_token_secret
JWT_REFRESH_SECRET=your_refresh_token_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin@123
AI_RISK_SERVICE_URL=http://localhost:8000
AI_RISK_TIMEOUT_MS=5000
RISK_ENGINE_MODE=AI_FIRST
AI_SERVICE_URL=http://localhost:8000
DELIVERY_QR_ENCRYPTION_SECRET=your_delivery_qr_secret
```

Ý nghĩa các biến quan trọng:

| Biến | Ý nghĩa |
| --- | --- |
| `NODE_ENV` | Môi trường chạy, thường là `development` khi làm local |
| `PORT` | Port backend, mặc định nên dùng `8088` |
| `SEED_INITIAL_DATA` | `true` để seed admin/bài viết ban đầu khi kết nối DB |
| `MONGO_DB_URL` | MongoDB connection string chính |
| `MONGO_URI` | Một số đoạn code có hỗ trợ tên biến này, có thể dùng dự phòng |
| `JWT_SECRET` | Secret ký access token |
| `JWT_EXPIRE` | Thời hạn access token |
| `JWT_TEMP_SECRET` | Secret cho token tạm OTP/reset password |
| `JWT_REFRESH_SECRET` | Secret ký refresh token |
| `EMAIL_USER` | Email gửi OTP |
| `EMAIL_PASS` | App password của email |
| `ADMIN_EMAIL` | Email admin seed ban đầu |
| `ADMIN_PASSWORD` | Mật khẩu admin seed ban đầu |
| `AI_RISK_SERVICE_URL` | URL service AI risk |
| `AI_RISK_TIMEOUT_MS` | Timeout khi gọi AI service |
| `RISK_ENGINE_MODE` | Chế độ đánh giá risk |
| `AI_SERVICE_URL` | URL service AI dùng ở các module khác nếu có |
| `DELIVERY_QR_ENCRYPTION_SECRET` | Secret mã hóa/xác thực QR giao hàng |

Lưu ý:

- Không nên commit file `.env`.
- Sau lần seed đầu tiên, nên đổi `SEED_INITIAL_DATA=false` để tránh seed lại không cần thiết.
- Nếu đổi `JWT_SECRET` hoặc `JWT_REFRESH_SECRET`, token cũ trong frontend/admin sẽ mất hiệu lực.

## 8. Chạy Backend

```bash
cd website-chatting
npm start
```

Script này chạy:

```bash
nodemon --exec babel-node src/server.js
```

Khi chạy thành công, backend sẽ:

1. Load biến môi trường từ `.env`.
2. Kết nối MongoDB.
3. Seed dữ liệu ban đầu nếu `SEED_INITIAL_DATA=true`.
4. Kết thúc các livestream cũ nếu cần.
5. Đăng ký REST routes.
6. Khởi tạo Socket.io.
7. Lắng nghe tại `http://localhost:8088`.

Kiểm tra nhanh:

```bash
curl http://localhost:8088/
```

Kết quả mong đợi:

```json
{ "message": "Backend API is running" }
```

## 9. Chạy Cả Hệ Thống Để Demo

Mở 3 terminal:

```bash
# Terminal 1: backend
cd website-chatting
npm start
```

```bash
# Terminal 2: frontend khách hàng
cd website-chatting-FE
npm run dev
```

```bash
# Terminal 3: admin/staff portal
cd website-chatting-ADMIN
npm run dev
```

Các URL:

```text
Backend:  http://localhost:8088
Customer: http://localhost:5173
Admin:    http://localhost:5174
```

## 10. Scripts Trong `package.json`

```bash
npm start
```

Chạy backend dev bằng Nodemon và Babel Node.

```bash
npm test
```

Chạy Mocha theo pattern `test/**/*.test.js`. Hiện tại repo chưa có thư mục `test/`, nên script này chỉ hữu ích khi nhóm bổ sung test backend.

```bash
npm run test:delivery-qr
```

Chạy smoke test luồng xác minh giao hàng bằng QR:

```text
scripts/deliveryVerification.smoke.js
```

```bash
npm run test:chat
```

Chạy smoke test luồng chat realtime:

```text
scripts/chatVerification.smoke.js
```

```bash
npm run migrate:delivery-qr
```

Chạy script migrate dữ liệu QR giao hàng cũ:

```text
scripts/migrateLegacyDeliveryQr.js
```

## 11. API Tổng Quan

### Auth

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `POST` | `/api/register` | Đăng ký và gửi OTP |
| `POST` | `/api/verify-otp` | Xác thực OTP |
| `POST` | `/api/login` | Đăng nhập |
| `POST` | `/api/refresh-token` | Làm mới access token |
| `POST` | `/api/logout` | Đăng xuất |
| `POST` | `/api/forgot-password` | Gửi yêu cầu quên mật khẩu |
| `POST` | `/api/reset-password` | Đặt lại mật khẩu |
| `PATCH` | `/api/me/password` | Đổi mật khẩu |

### Profile

| Method | Endpoint | Role |
| --- | --- | --- |
| `GET` | `/user/profile` | `R2` |
| `GET` | `/admin/profile` | `R1` |
| `GET` | `/manager/profile` | `R3` |
| `GET` | `/shipper/profile` | `R4` |

### Sản phẩm

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `GET` | `/api/products/home` | Sản phẩm trang chủ |
| `GET` | `/api/products` | Tìm kiếm/lọc sản phẩm |
| `GET` | `/api/products/:slug` | Chi tiết sản phẩm |
| `GET` | `/api/products/categories` | Danh mục sản phẩm |
| `GET` | `/api/products/best-seller` | Sản phẩm bán chạy |
| `GET` | `/api/products/most-viewed` | Sản phẩm xem nhiều |
| `GET` | `/api/products/favorites` | Sản phẩm yêu thích của user |
| `POST` | `/api/products/:productId/favorite` | Toggle yêu thích |
| `GET` | `/api/products/recently-viewed` | Sản phẩm đã xem gần đây |
| `POST` | `/api/products/:slug/viewed` | Ghi nhận đã xem |

### Admin/manager sản phẩm

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `GET` | `/api/admin/products` | Danh sách sản phẩm quản trị |
| `POST` | `/api/admin/products` | Thêm sản phẩm |
| `PATCH` | `/api/admin/products/:id` | Sửa sản phẩm |
| `PATCH` | `/api/admin/products/:id/status` | Đổi trạng thái sản phẩm |
| `DELETE` | `/api/admin/products/:id` | Xóa sản phẩm, chỉ admin theo middleware |

### Giỏ hàng

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `GET` | `/api/cart` | Lấy giỏ hàng hiện tại |
| `POST` | `/api/cart/items` | Thêm sản phẩm vào giỏ |
| `PATCH` | `/api/cart/items/:productId` | Cập nhật số lượng |
| `DELETE` | `/api/cart/items/:productId` | Xóa một sản phẩm |
| `DELETE` | `/api/cart` | Xóa toàn bộ giỏ |

### Đơn hàng và thanh toán

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `POST` | `/api/orders/checkout` | Đặt hàng |
| `POST` | `/api/orders/checkout/preview` | Preview tổng tiền/voucher |
| `GET` | `/api/orders/my` | Đơn hàng của tôi |
| `GET` | `/api/orders/my/:orderIdOrCode` | Chi tiết đơn của tôi |
| `PATCH` | `/api/orders/my/:orderIdOrCode/cancel` | Hủy/yêu cầu hủy đơn |
| `POST` | `/api/orders/my/:orderIdOrCode/pay` | Thanh toán lại VNPAY |
| `GET` | `/api/payments/vnpay-return` | VNPAY return |
| `GET` | `/api/payments/vnpay-ipn` | VNPAY IPN |

### Admin/manager đơn hàng và QR giao hàng

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `GET` | `/api/admin/orders` | Danh sách đơn |
| `GET` | `/api/admin/orders/:orderIdOrCode` | Chi tiết đơn |
| `PATCH` | `/api/admin/orders/:orderIdOrCode/status` | Cập nhật trạng thái |
| `PATCH` | `/api/admin/orders/:orderIdOrCode/cancel-request` | Duyệt/từ chối yêu cầu hủy |
| `POST` | `/api/admin/orders/:orderIdOrCode/delivery-qr` | Tạo QR giao hàng |
| `GET` | `/api/admin/orders/:orderIdOrCode/delivery-qr` | Lấy QR giao hàng |
| `POST` | `/api/orders/delivery/verify` | Xác minh QR giao hàng |

### Dashboard/settings/user management

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `GET` | `/api/admin/dashboard/overview` | Tổng quan |
| `GET` | `/api/admin/dashboard/revenue` | Doanh thu |
| `GET` | `/api/admin/dashboard/order-status` | Trạng thái đơn |
| `GET` | `/api/admin/dashboard/top-products` | Top sản phẩm |
| `GET` | `/api/admin/dashboard/recent-orders` | Đơn gần đây |
| `GET` | `/api/admin/dashboard/new-customers` | Khách hàng mới |
| `GET` | `/api/admin/dashboard/cashflow` | Dòng tiền |
| `GET` | `/api/admin/settings` | Lấy settings |
| `PATCH` | `/api/admin/settings` | Cập nhật settings |
| `GET` | `/api/admin/users` | Danh sách user |
| `POST` | `/api/admin/users` | Tạo user |
| `PUT` | `/api/admin/users/:id` | Cập nhật user |
| `PATCH` | `/api/admin/users/:id/reset-password` | Reset mật khẩu user |
| `DELETE` | `/api/admin/users/:id` | Xóa user |

### Voucher, loyalty, review, notification

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `GET` | `/api/vouchers/my` | Voucher khả dụng của khách |
| `GET` | `/api/admin/vouchers` | Danh sách voucher quản trị |
| `POST` | `/api/admin/vouchers` | Tạo voucher |
| `GET` | `/api/admin/vouchers/:id` | Chi tiết voucher |
| `PUT` | `/api/admin/vouchers/:id` | Sửa voucher |
| `DELETE` | `/api/admin/vouchers/:id` | Xóa voucher |
| `GET` | `/api/loyalty/me` | Điểm loyalty của tôi |
| `GET` | `/api/reviews/products/:slug` | Review theo sản phẩm |
| `POST` | `/api/reviews` | Tạo review |
| `GET` | `/api/notifications` | Danh sách thông báo |
| `PATCH` | `/api/notifications/read-all` | Đánh dấu tất cả đã đọc |
| `PATCH` | `/api/notifications/:id/read` | Đánh dấu một thông báo đã đọc |

### Chat, livestream và live chat

Các API chat chính:

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `POST` | `/api/chat/send` | Gửi tin nhắn |
| `GET` | `/api/chat/support` | Lấy tài khoản hỗ trợ |
| `GET` | `/api/chat/users` | Lấy danh sách user chat |
| `GET` | `/api/chat/users/:id` | Lấy thông tin user chat |
| `GET` | `/api/chat/history/:senderId/:receiverId` | Lịch sử chat |
| `PATCH` | `/api/chat/read/:senderId` | Đánh dấu đã đọc |
| `GET` | `/api/chat/contacts` | Danh sách contact chat |

Livestream và live chat được khai báo trong:

```text
src/route/livestream.route.js
```

Các endpoint chính gồm:

- Lấy livestream hiện tại.
- Bắt đầu livestream.
- Kết thúc livestream.
- Xem lịch sử livestream.
- Lấy tin nhắn live chat gần đây.
- Quản lý moderation case.
- Xử lý yêu cầu mở cấm live chat.

## 12. Socket.io

Socket.io được khởi tạo trên cùng HTTP server với Express.

Các module dùng realtime:

- Notification.
- Chat hỗ trợ.
- Livestream WebRTC signaling.
- Live chat.
- Kiểm duyệt live chat.

Client thường join room bằng event:

```text
join
```

Payload dạng:

```json
{
  "userId": "id-cua-user",
  "roleId": "R1"
}
```

Các màn hình frontend/admin đang sử dụng socket nằm ở:

```text
website-chatting-FE/src/services/socket.js
website-chatting-FE/src/sockets/livestreamSocket.js
website-chatting-ADMIN/src/services/socket.js
website-chatting-ADMIN/src/sockets/livestreamSocket.js
```

## 13. Postman

Thư mục `postman/` có các collection:

```text
BTVN_Register_BuiThanhTung.postman_collection.json
BTVN_Login_VuMinhKhang.postman_collection.json
BTVN_ForgotPassword_PhamPhucTien.postman_collection.json
EditProfile.postman_collection.json
```

Cách dùng:

1. Mở Postman.
2. Import các file trong thư mục `postman/`.
3. Đặt base URL là:

```text
http://localhost:8088
```

4. Chạy request theo đúng thứ tự của từng collection.

## 14. Kiểm Thử

### Test backend

Script có sẵn:

```bash
npm test
```

Hiện repo chưa có thư mục `test/`, nên nhóm có thể bổ sung test vào:

```text
test/**/*.test.js
```

### Smoke test QR giao hàng

```bash
npm run test:delivery-qr
```

### Smoke test chat

```bash
npm run test:chat
```

### Test frontend/admin bằng Cypress

Test E2E nằm ở hai repo frontend:

```text
website-chatting-FE/cypress/e2e/
website-chatting-ADMIN/cypress/e2e/
```

Chạy customer Cypress:

```bash
cd website-chatting-FE
npx cypress run
```

Chạy admin Cypress:

```bash
cd website-chatting-ADMIN
npx cypress run
```

## 15. Luồng Demo Gợi Ý Khi Chấm Điểm

1. Chạy backend `website-chatting`.
2. Kiểm tra `http://localhost:8088/`.
3. Chạy `website-chatting-FE` ở `http://localhost:5173`.
4. Chạy `website-chatting-ADMIN` ở `http://localhost:5174`.
5. Đăng nhập admin được seed từ `ADMIN_EMAIL` và `ADMIN_PASSWORD`.
6. Trên admin: xem dashboard, quản lý sản phẩm, đơn hàng, voucher.
7. Trên customer: đăng ký/đăng nhập, tìm sản phẩm, thêm giỏ, checkout.
8. Trên admin: cập nhật trạng thái đơn và tạo QR giao hàng.
9. Trên shipper: đăng nhập tài khoản `R4`, vào `/shipper/delivery`, quét QR.
10. Trên admin: mở livestream.
11. Trên customer: vào `/livestream`, xem live và gửi live chat.
12. Trên admin/manager: kiểm duyệt live chat.
13. Kiểm tra notification/chat realtime.

## 16. Lỗi Thường Gặp

### Không kết nối được MongoDB

Kiểm tra:

- MongoDB local đã chạy chưa.
- `MONGO_DB_URL` có đúng chưa.
- Nếu dùng Atlas, IP hiện tại đã được whitelist chưa.

### Không seed được admin

Kiểm tra:

- `SEED_INITIAL_DATA=true`.
- Có đủ `ADMIN_EMAIL` và `ADMIN_PASSWORD`.
- MongoDB đã kết nối thành công.

### Frontend báo lỗi CORS hoặc không gọi được API

Kiểm tra:

- Backend có chạy ở `8088` không.
- FE có `VITE_BACKEND_URL=http://localhost:8088/api` không.
- Admin portal có chạy đúng `5174` không.
- Nếu đổi port, cần cập nhật CORS/proxy/env tương ứng.

### OTP/email không gửi được

Kiểm tra:

- `EMAIL_USER`.
- `EMAIL_PASS`.
- Nếu dùng Gmail, cần app password thay vì mật khẩu Gmail thường.

### Token lỗi hoặc bị logout liên tục

Nguyên nhân thường gặp:

- Đổi JWT secret.
- Refresh token hết hạn hoặc bị xóa.
- LocalStorage còn token cũ.

Cách xử lý:

- Xóa localStorage ở trình duyệt.
- Đăng nhập lại.

### VNPAY không return đúng

Kiểm tra:

- Credentials VNPAY sandbox.
- URL return/IPN.
- Đồng bộ thời gian máy.
- Backend có mở port mà VNPAY sandbox có thể gọi tới không nếu test IPN thật.

### QR giao hàng xác minh thất bại

Kiểm tra:

- QR có được tạo từ đúng đơn hàng không.
- `DELIVERY_QR_ENCRYPTION_SECRET` có bị đổi sau khi tạo QR không.
- Đơn hàng có ở trạng thái cho phép xác minh không.
- Tài khoản xác minh có đúng role `R2` hoặc `R4` không.

## 17. Ghi Chú Phát Triển

- Không commit `.env`.
- Khi đổi port backend, cần cập nhật:
  - `website-chatting-FE/.env`
  - `website-chatting-ADMIN/.env` nếu có
  - `vite.config.js` proxy nếu cần
  - Cypress `baseUrl` nếu đổi port frontend
- Khi sửa API auth, cần test lại interceptor refresh token ở cả FE và ADMIN.
- Khi sửa order/payment, nên test cả COD, VNPAY return, retry payment và admin update status.
- Khi sửa chat/livestream, cần test cả REST API và Socket.io.
- Khi sửa QR giao hàng, nên chạy smoke test `npm run test:delivery-qr`.
- Khi sửa UI customer/admin, nên chạy Cypress ở repo tương ứng.

# Ecommerce Management System - Backend API

Backend Node.js/Express cho he thong thuong mai dien tu cua nhom. Service nay cung cap REST API, ket noi MongoDB, xu ly xac thuc JWT/OTP, gio hang, dat hang, thanh toan VNPAY, voucher, loyalty, review, dashboard quan tri, chat realtime, livestream va QR xac minh giao hang.

## Vai tro trong he thong

Repo nay la lop server dung chung cho:

- `website-chatting-FE`: giao dien khach hang.
- `website-chatting-ADMIN`: giao dien admin/manager/shipper.
- `ai-risk-service`: dich vu AI tinh rui ro don hang, duoc goi thong qua bien moi truong `AI_RISK_SERVICE_URL`.

Mac dinh backend chay tai `http://localhost:8088`, cac API chinh nam duoi prefix `/api`, rieng mot so route profile/admin cu giu dang `/user/profile`, `/admin/profile`, `/admin/users`.

## Cong nghe chinh

- Node.js + Express 5.
- MongoDB + Mongoose.
- JWT access token, refresh token va role-based authorization.
- Socket.io cho chat, thong bao realtime va livestream.
- Nodemailer cho OTP/email.
- VNPAY SDK cho thanh toan online.
- Express Validator va rate limit cho validation/chong spam.
- Mocha, Chai, Supertest cho test backend.
- Babel Node/Nodemon cho moi truong dev.

## Chuc nang noi bat

- Dang ky tai khoan, xac thuc OTP, dang nhap, dang xuat, refresh token.
- Quen mat khau, dat lai mat khau, doi mat khau.
- Phan quyen theo role:
  - `R1`: Admin.
  - `R2`: Customer/User.
  - `R3`: Manager.
  - `R4`: Shipper.
- Quan ly user, profile, dashboard, settings.
- Quan ly san pham, danh muc, san pham yeu thich, san pham da xem gan day.
- Gio hang, checkout, huy don, cap nhat trang thai don hang.
- Thanh toan COD va VNPAY, retry thanh toan, callback VNPAY return.
- Voucher, diem tich luy, wallet transaction va preview gia tri checkout.
- Review san pham va ma khuyen mai sau danh gia.
- QR giao hang cho shipper xac minh don.
- Chat ho tro khach hang, lich su chat, thong bao realtime.
- Livestream ban hang, live chat va moderation.
- Tich hop AI risk service de danh gia rui ro don COD.

## Cau truc thu muc

```text
src/
  config/        Ket noi MongoDB va cau hinh Socket.io
  controllers/   Xu ly request/response cho tung domain
  middleware/    Auth, role guard, validator, rate limit
  models/        Mongoose models
  route/         Khai bao REST routes
  seed/          Seed du lieu ban dau
  services/      Business logic
  sockets/       Socket.io handlers cho chat/livestream
  utils/         JWT, email, notification, response helper
  validators/    Validator rieng cho profile
scripts/         Script smoke test va migrate
postman/         Postman collections theo cac module test
```

## Yeu cau truoc khi chay

- Node.js 18+.
- npm.
- MongoDB local hoac MongoDB Atlas.
- Tai khoan email app password neu can gui OTP.
- VNPAY sandbox credentials neu test thanh toan online.
- Neu test AI risk: chay them service AI o `http://localhost:8000`.

## Cai dat

```bash
npm install
```

Tao file `.env` tu `.env.example`:

```bash
cp .env.example .env
```

Vi du cau hinh toi thieu:

```env
NODE_ENV=development
PORT=8088
SEED_INITIAL_DATA=true
MONGO_DB_URL=mongodb://127.0.0.1:27017/ecommerce-management
JWT_SECRET=your_access_secret
JWT_EXPIRE=1h
JWT_TEMP_SECRET=your_temp_secret
JWT_REFRESH_SECRET=your_refresh_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin@123
AI_RISK_SERVICE_URL=http://localhost:8000
AI_RISK_TIMEOUT_MS=5000
RISK_ENGINE_MODE=AI_FIRST
AI_SERVICE_URL=http://localhost:8000
```

`SEED_INITIAL_DATA=true` se seed du lieu khoi tao khi server ket noi MongoDB thanh cong. Sau lan dau co the doi ve `false` de tranh seed lai.

## Chay local

```bash
npm start
```

Server se:

1. Load bien moi truong tu `.env`.
2. Ket noi MongoDB.
3. Seed du lieu neu `SEED_INITIAL_DATA=true`.
4. Ket thuc cac phien livestream cu neu co.
5. Dang ky REST routes va Socket.io.
6. Lang nghe tai `http://localhost:8088`.

Kiem tra nhanh:

```bash
curl http://localhost:8088/
```

Ket qua mong doi:

```json
{ "message": "Backend API is running" }
```

## Scripts

```bash
npm start
```

Chay server dev bang `nodemon --exec babel-node src/server.js`.

```bash
npm test
```

Chay test Mocha trong `test/**/*.test.js`.

```bash
npm run test:delivery-qr
```

Smoke test luong xac minh giao hang bang QR.

```bash
npm run test:chat
```

Smoke test luong chat realtime.

```bash
npm run migrate:delivery-qr
```

Migrate du lieu QR giao hang cu.

## API tong quan

Auth:

- `POST /api/register`
- `POST /api/verify-otp`
- `POST /api/login`
- `POST /api/refresh-token`
- `POST /api/logout`
- `POST /api/forgot-password`
- `POST /api/reset-password`
- `PATCH /api/me/password`

Customer:

- `GET /api/products/home`
- `GET /api/products`
- `GET /api/products/:slug`
- `GET /api/products/categories`
- `POST /api/products/:productId/favorite`
- `GET /api/cart`
- `POST /api/orders/checkout`
- `POST /api/orders/checkout/preview`
- `GET /api/orders/my`
- `PATCH /api/orders/my/:orderIdOrCode/cancel`
- `GET /api/payments/vnpay-return`
- `GET /api/vouchers/my`
- `GET /api/loyalty/me`
- `GET /api/notifications`

Admin/manager/shipper:

- `GET /api/admin/dashboard/overview`
- `GET /api/admin/dashboard/revenue`
- `GET /api/admin/dashboard/order-status`
- `GET /api/admin/dashboard/top-products`
- `GET /api/admin/dashboard/recent-orders`
- `GET /api/admin/settings`
- `PATCH /api/admin/settings`
- `GET /admin/users`
- `POST /admin/users`
- `PUT /admin/users/:id`
- `PATCH /admin/users/:id/reset-password`
- `DELETE /admin/users/:id`
- `GET /api/admin/vouchers`
- `POST /api/admin/vouchers`
- `PUT /api/admin/vouchers/:id`
- `DELETE /api/admin/vouchers/:id`
- `POST /api/orders/delivery/verify`

Realtime:

- Socket.io duoc khoi tao tren cung HTTP server.
- Client co the join room theo `user:{userId}` hoac `role:{roleId}` thong qua event `join`.
- Cac module chat, notification va livestream dung Socket.io de cap nhat giao dien tuc thoi.

## Ket noi voi frontend

- Customer frontend mac dinh goi backend qua `VITE_BACKEND_URL=http://localhost:8088/api`.
- Admin frontend cung dung backend nay va thuong chay port `5174`.
- CORS da mo cho `localhost:5173`, `localhost:5174`, `localhost:3000` va cac bien the `127.0.0.1`.

Thu tu chay de test day du:

```bash
# Terminal 1
cd website-chatting
npm start

# Terminal 2
cd website-chatting-FE
npm run dev

# Terminal 3
cd website-chatting-ADMIN
npm run dev
```

## Postman

Thu muc `postman/` co cac collection ho tro kiem thu:

- Register.
- Login.
- Forgot password.
- Edit profile.

Co the import vao Postman va cau hinh bien base URL la `http://localhost:8088`.

## Luu y phat trien

- Khong commit file `.env`.
- Doi secret JWT/email/VNPAY khi deploy.
- Neu doi port backend, cap nhat lai `VITE_BACKEND_URL` trong hai repo frontend.
- Neu sua API auth, can kiem tra interceptor refresh token o frontend/admin.
- Neu sua order/payment, nen test ca COD, VNPAY return va retry payment.
- Neu sua chat/livestream, can test ca REST API lan Socket.io event.

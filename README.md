# 🏥 PEACE DENTAL - Hệ Thống Chấm Công & Phê Duyệt Nhân Sự Tập Trung

Hệ thống quản lý chấm công, phân ca, phê duyệt đơn từ đa cấp và số hóa quy trình nhân sự chuẩn hóa dành riêng cho chuỗi nha khoa và phòng khám **PEACE Dental**.

---

## 🔒 CẢNH BÁO AN TOÀN & QUY ĐỊNH BẢO MẬT (SECURITY & COMPLIANCE)

> [!CAUTION]
> **BẢO MẬT BIẾN MÔI TRƯỜNG & KHÓA BÍ MẬT:**
> - Tuyệt đối **KHÔNG** commit file `.env` chứa mật khẩu cơ sở dữ liệu thực, mã `JWT_SECRET` hoặc `TELEGRAM_BOT_TOKEN` lên kho lưu trữ công khai.
> - Sử dụng file `.env.example` làm mẫu cấu hình khi bàn giao triển khai.
> - Luôn tạo chuỗi ký tự ngẫu nhiên, độ dài tối thiểu 32 ký tự cho `JWT_SECRET` trên môi trường Production.

> [!WARNING]
> **BẢO VỆ DỮ LIỆU ĐỊA ĐIỂM & QUYỀN RIÊNG TƯ (GPS & CAMERA):**
> - Hệ thống chỉ yêu cầu quyền định vị GPS và Camera tại thời điểm nhân viên thực hiện thao tác Check-in / Check-out hoặc chụp ảnh kèm phiếu giấy.
> - Toàn bộ dữ liệu vị trí và hình ảnh chỉ được lưu trữ nội bộ phục vụ mục đích đối soát bảng công, không chia sẻ cho bên thứ ba.
> - Hệ thống bắt buộc phải chạy qua giao thức bảo mật **HTTPS (SSL)** trên Production để trình duyệt cấp quyền Camera & GPS.

---

## 🌟 TÍNH NĂNG NỔI BẬT

### 1. 📍 Chấm công Đa phương thức (Smart Attendance)
- **GPS Geofencing + Selfie:** Xác thực tọa độ chi nhánh trong bán kính cho phép (mặc định 200m) kèm ảnh chụp trực tiếp từ camera.
- **Dung sai ca & Quy tắc trễ:**
  - Check-in đúng giờ: 07:45 - 08:00 (chuẩn ca sáng).
  - Trễ > 30 phút (sau 08:15): Tự động hủy công ca sáng (chỉ tính 2 công cho ca chiều + tối), trừ khi có phiếu giải trình hoặc đơn xin nghỉ 0.5 ca được duyệt.

### 2. ⚡ Tăng ca & Overtime (OT x2)
- Tăng ca từ 15 phút trở lên ngoài giờ chuẩn được tự động nhân đôi (Hệ số x2) vào quỹ công/giờ tăng ca.
- Tích hợp luồng lập và duyệt Phiếu xác nhận tăng ca.

### 3. ✍️ Quy trình Phê duyệt Đa cấp & Số hóa Phiếu Giấy (Offline Digitization)
- **Đầy đủ 13 loại biểu mẫu chuẩn:** Nghỉ phép năm, Nghỉ không lương, Nghỉ ốm BHXH, Nghỉ việc riêng, Nghỉ nửa ca (0.5 công), Phiếu quên chấm công, Phiếu giải trình đi trễ/về sớm, Phiếu tăng ca (OT x2), Làm bù, Đi học/Đào tạo, Công tác, v.v.
- **Số hóa đơn viết tay/ký sống:** Trung tâm dành riêng cho HR (`/admin/digitize`) nhập nhanh các đơn bác sĩ/quản lý đã duyệt tay trên giấy.
- **Đính kèm ảnh minh chứng (Tùy chọn):** Hỗ trợ kéo thả ảnh hoặc chụp trực tiếp từ camera, kèm tính năng phóng to (Zoom Modal) đối soát nhanh.

### 4. 📊 Ma trận Bảng công & Xuất Excel
- Tự động tổng hợp dữ liệu chấm công, ngày nghỉ phép, ngày giải trình thành bảng công tháng hoàn chỉnh.
- Hỗ trợ **Điều chỉnh thủ công (Manual Override)** dành cho nhân sự đặc cách/đi học có quyền Quản lý/HR.
- Xuất file báo cáo Excel chuẩn định dạng đa sheet.

---

## 🛠️ HƯỚNG DẪN CÀI ĐẶT & TRIỂN KHAI

### 1. Yêu cầu hệ thống
- **Node.js:** Phiên bản `>= 18.17.0` (Khuyên dùng Node.js 20 LTS)
- **NPM** hoặc **Yarn**
- **Git**

### 2. Cài đặt các gói phụ thuộc
```bash
# Cài đặt thư viện
npm install

# Khởi tạo và cập nhật cấu trúc cơ sở dữ liệu
npx prisma generate
npx prisma db push

# Nạp dữ liệu mẫu ban đầu (Chi nhánh, Ca làm việc, Tài khoản demo)
npm run prisma:seed
```

### 3. Cấu hình biến môi trường
Sao chép file `.env.example` thành `.env`:
```bash
cp .env.example .env
```
Chỉnh sửa file `.env` theo thông tin thực tế:
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-strong-production-jwt-secret-key-32chars"
NEXT_PUBLIC_APP_URL="https://chamcong.nhakhoapeace.vn"
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
```

### 4. Chạy hệ thống

#### Chế độ Phát triển (Development):
```bash
npm run dev
# Truy cập: http://localhost:3000
```

#### Chế độ Vận hành Thực tế (Production):
```bash
# Build mã nguồn
npm run build

# Khởi chạy ngầm với PM2
npm install -g pm2
pm2 start npm --name "peace-chamcong" -- start -- -p 3000
pm2 save
pm2 startup
```

---

## 👥 TÀI KHOẢN TRẢI NGHIỆM HỆ THỐNG (DEMO ROLES)

| Email Đăng Nhập | Mật Khẩu Mặc Định | Vai Trò (Role) | Phạm Vi Quyền Hạn |
| :--- | :--- | :--- | :--- |
| `admin@peace.vn` | `admin123` | **SUPER_ADMIN** | Toàn quyền hệ thống, cấu hình chi nhánh, ca, phân quyền |
| `hr@peace.vn` | `admin123` | **HR_ADMIN** | Phê duyệt cấp 2, số hóa đơn giấy, quản lý bảng công, xuất Excel |
| `manager@peace.vn` | `admin123` | **MANAGER** | Quản lý chi nhánh, duyệt đơn cấp 1, xếp ca nhân sự |
| `lam@peace.vn` | `user123` | **EMPLOYEE** | Bác sĩ / Kỹ thuật viên (Chấm công GPS, nộp đơn, xem lịch sử) |
| `hoa@peace.vn` | `user123` | **EMPLOYEE** | Phụ tá nha khoa (Chấm công GPS, nộp đơn, xem lịch sử) |

---

## 🧪 BỘ KIỂM THỬ TỰ ĐỘNG (AUTOMATED TEST SUITES)

Dự án tích hợp sẵn bộ kiểm thử E2E 100% tự động kiểm tra toàn bộ luồng nghiệp vụ:
```bash
# Chạy toàn bộ 159 kịch bản kiểm thử E2E
node scripts/run_e2e_tests.js
```

---

## 📄 BẢN QUYỀN
Hệ thống được phát triển nội bộ cho chuỗi **PEACE Dental Clinic**. Mọi quyền được bảo lưu.

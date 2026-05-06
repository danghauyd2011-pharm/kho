# 💊 Kho Thuốc BV Đà Nẵng

Hệ thống quản lý kho thuốc đa chức năng — chạy hoàn toàn trên trình duyệt.

## 📁 Cấu trúc repo

```
kho-thuoc/
├── index.html        ← App shell (HTML layout)
├── style.css         ← Toàn bộ CSS
├── shared.js         ← State dùng chung + GitHub Sync
├── module-bbhv.js    ← Biên Bản Huỷ Vỏ
├── module-tk.js      ← Thẻ kho + BBKK + Báo cáo XNT
├── module-tt20.js    ← Tra cứu TT20
├── module-utils.js   ← Tiện ích layout, mobile
└── README.md
```

## ✨ Tính năng

### 📋 BBHV — Biên Bản Huỷ Vỏ
- Load file Xuất + Nhập → auto xử lý
- Biên bản theo ngày / tháng / sổ trả vỏ

### 📦 Thẻ Kho
- Thẻ kho từng mặt hàng
- Biên bản kiểm kê cuối tháng (BBKK)
- **Báo cáo Xuất Nhập Tồn** (A4 ngang, chuẩn mẫu)
- Xuất Excel + In PDF

### ☁️ GitHub Sync (quan trọng cho người hay đổi máy)
Lưu dữ liệu BBKK lên GitHub — **không bao giờ mất dữ liệu** dù đổi máy hay xoá cache.

**Cách cài đặt GitHub Sync:**
1. Tạo [Personal Access Token](https://github.com/settings/tokens) (scope: `repo`)
2. Vào app → Tab Thẻ kho → Nạp dữ liệu → Điền Token + Repo
3. Bấm **💾 Lưu cấu hình**
4. Cuối tháng: bấm **⬆️ Lưu BBKK lên GH**
5. Đổi máy: mở app → bấm **⬇️ Tải BBKK từ GH** → tự động restore

### 🔄 Realtime Integration
Khi load cả 2 file Xuất + Nhập ở **bất kỳ tab nào** → cả BBHV và Thẻ kho đều tự động xử lý.

## 🚀 Deploy GitHub Pages

1. Fork repo này
2. Settings → Pages → Source: main branch / root
3. Truy cập: `https://<username>.github.io/<repo-name>/`

## 🛠️ Thêm tính năng mới

Mỗi module độc lập — chỉ sửa file tương ứng:
- Tính năng BBHV → sửa `module-bbhv.js`
- Tính năng Thẻ kho / BBXNT → sửa `module-tk.js`
- Tính năng TT20 → sửa `module-tt20.js`
- CSS → sửa `style.css`
- GitHub sync / state dùng chung → sửa `shared.js`


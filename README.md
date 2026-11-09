# MyEzvizCam Pro — Ứng dụng giám sát camera (Web · Mobile · PC)

Giao diện người dùng cho hệ thống **MyEzvizCam Pro**, được dựng lại từ đầu theo file thiết kế và dùng đúng các API trong tài liệu bàn giao Backend. Ứng dụng chạy trên mọi trình duyệt và **cài được như app** (PWA) lên điện thoại Android/iPhone, máy tính Windows/macOS. Giao diện tự co giãn theo màn hình: thanh bên cho PC, thanh tab dưới cùng cho điện thoại.

## Màn hình

- **Đăng nhập**: đăng nhập bằng cookie phiên 12 giờ, báo lỗi sai mật khẩu và khóa tạm 15 phút (mã 429).
- **Trực tiếp**: chọn camera, xem các chỉ số KPI, xem luồng MJPEG trực tiếp với 3 mức chất lượng (Tiết kiệm/HD/2K), tạm dừng (ngắt hẳn kết nối), toàn màn hình, chụp ảnh và tải về, điều khiển PTZ bằng cách nhấn giữ (hoặc phím mũi tên trên PC), xem trạng thái phát hiện chuyển động ONVIF.
- **Sự kiện & Phát lại**: lọc theo camera và ngày, xem badge trạng thái tải lên, phát lại clip qua URL có chữ ký (hỗ trợ tua), tải xuống, đếm ngược thời hạn liên kết, ghi clip thủ công.
- **Hệ thống**: xem hàng đợi chờ/lỗi, thời gian lưu giữ, giới hạn tải lên, chế độ đồng ý quyền riêng tư, các listener ONVIF và tính năng của từng camera.

## Kết nối với Backend Python

Backend đặt cookie `HttpOnly; SameSite=Strict`, nên giao diện và API phải nằm chung một domain. Một Netlify Edge Function (`netlify/edge-functions/api-proxy.ts`) chuyển tiếp mọi request `/api/v1/*` tới backend. Luồng MJPEG, việc tua video (HTTP Range) và cookie đều đi qua nguyên vẹn.

1. Mở backend ra Internet bằng một tunnel, ví dụ Cloudflare Tunnel hoặc Tailscale Funnel trỏ tới `http://127.0.0.1:8080`.
2. Trong Netlify, vào **Project configuration → Environment variables** và đặt `EZVIZ_BACKEND_URL` bằng URL công khai đó, ví dụ `https://cam.example.com`.
3. Deploy lại. Ứng dụng tự nhận ra backend thật và bỏ chế độ demo.

Khi **chưa** đặt `EZVIZ_BACKEND_URL`, ứng dụng chạy ở **chế độ demo**: dữ liệu mẫu, camera mô phỏng có thể xoay PTZ, và các trạng thái sự kiện đủ loại. Tài khoản demo là `admin` / `demo`.

## Công nghệ

- TanStack Start (React 19, TypeScript), Vite. Deploy lên Netlify không cần cấu hình thêm.
- Toàn bộ giao diện viết bằng CSS thuần (`src/app.css`) theo thiết kế, dùng font Inter đóng gói sẵn (có tiếng Việt).
- Netlify Edge Functions làm proxy cùng domain tới backend.
- PWA: có manifest, icon, và hỗ trợ chế độ standalone trên iOS và Android.

## Chạy trên máy

```bash
pnpm install          # hoặc npm install
pnpm dev              # http://localhost:3000, chế độ demo
netlify dev           # chạy kèm edge proxy; đặt EZVIZ_BACKEND_URL=http://127.0.0.1:8080 để nối backend thật
```

## Cài như ứng dụng

- **Android / Chrome / Edge (PC)**: mở trang, rồi chọn menu → *Cài đặt ứng dụng* hoặc *Install app*.
- **iPhone / iPad (Safari)**: bấm Chia sẻ → *Thêm vào MH chính*.

## Hướng phát triển tiếp

- Đóng gói app gốc bằng Capacitor (iOS/Android) hoặc Tauri (Windows/macOS) nếu cần đưa lên các kho ứng dụng.
- Service worker lưu sẵn giao diện để mở được khi offline.
- Thông báo đẩy khi có sự kiện mới. Việc này cần backend có thêm webhook hoặc kênh push.

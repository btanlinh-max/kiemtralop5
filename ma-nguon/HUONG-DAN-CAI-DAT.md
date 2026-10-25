# Hướng dẫn cài đặt – Hệ thống đề kiểm tra & ôn tập lớp 5

Làm **1 lần**, khoảng 10 phút, trên máy tính. Người làm: khối trưởng (cô Hạnh).

## Bước 1 – Tạo kho dữ liệu Google Sheets (để mọi máy dùng chung)

1. Vào https://sheets.new (đăng nhập Gmail **phhanh90@gmail.com**). Đặt tên bảng tính: `Dữ liệu đề lớp 5`.
2. Trên thanh menu: **Tiện ích mở rộng → Apps Script**.
3. Xoá hết chữ có sẵn, dán toàn bộ nội dung file `Code.gs` (gửi kèm).
4. Ở dòng `var MA_KHOI = 'khoi5';` đổi `khoi5` thành **mã bí mật của khối**, ví dụ `vtv5-2026`.
   Chỉ giáo viên khối 5 được biết mã này (dùng khi đăng nhập Giáo viên trên web).
5. Bấm **💾 Lưu**. Chọn hàm `caiDat` ở ô trên cùng → bấm **▶ Chạy** → **Xem xét quyền** → chọn Gmail →
   **Nâng cao → Đi tới … (không an toàn)** → **Cho phép**. (Đây là mã của chính cô nên an toàn.)
6. Bấm **Triển khai → Tùy chọn triển khai mới** → biểu tượng ⚙️ chọn **Ứng dụng web**:
   - Thực thi với tư cách: **Tôi**
   - Người có quyền truy cập: **Bất kỳ ai**
   → **Triển khai** → sao chép **URL ứng dụng web** (đuôi `/exec`).
7. Mở web → Giáo viên → **⚙️ Cài đặt → Kết nối Google Sheets**: dán URL, nhập mã khối → **Lưu & kiểm tra kết nối**.
   (Hoặc gửi URL cho người làm web để cài sẵn, học sinh không phải làm gì.)

> Sửa mã Apps Script sau này: **Triển khai → Quản lý triển khai → ✏️ → Phiên bản: Mới → Triển khai** (giữ nguyên URL).

## Bước 2 – Mã AI Gemini (mỗi giáo viên tự lấy, miễn phí)

1. Vào https://aistudio.google.com/apikey → **Create API key** → sao chép.
2. Trên web: **⚙️ Cài đặt → Mã AI Gemini** → dán → **Lưu & thử**.

Mã lưu trên máy của từng người, không ai dùng chung lượt của ai. Học sinh **không cần** mã AI.

## Bước 3 – Danh sách lớp

**Học sinh & Ôn tập → Danh sách lớp** → nhập file Excel (cột "Họ và tên") hoặc dán danh sách.
Học sinh sẽ chọn tên mình, không gõ sai tên.

## Bước 4 – Giao bài

Ngân hàng đề → **Giao bài / QR** → chiếu mã QR lên màn hình hoặc **chép tin nhắn gửi nhóm Zalo phụ huynh**.
Học sinh làm trên điện thoại, iPad, máy tính. Không cần tài khoản.

## Đồng nghiệp trong khối dùng thế nào?

Mở cùng đường link web → **Giáo viên** → nhập Gmail, họ tên, **mã khối** → dùng chung ngân hàng đề, tài liệu, kết quả.
Mỗi người tự lấy mã AI riêng (Bước 2).

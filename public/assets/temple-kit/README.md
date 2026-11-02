# Chùa Linh Ứng — 3D Asset Kit v1

Các ảnh được tách từ asset sheet tham chiếu cho scene Three.js dọc 9:16.

## Quy ước
- PNG RGBA: vật thể tách nền để dùng làm billboard/reference plane hoặc dựng lại mesh.
- JPG: texture tham chiếu cho bề mặt lớn; cần UV unwrap/material mapping trước khi dùng làm texture 3D.
- Đây là bộ asset tham chiếu/texture 2D, không phải mô hình 3D GLB và không thay thế mesh có chiều sâu.

## Assets
| File | Dùng cho |
|---|---|
| `buddha-statue.png` | Tượng Phật tham chiếu; ưu tiên dựng/thay GLB, không dùng billboard trong góc camera tự do |
| `abbot-monk.png` | Trụ trì tham chiếu để dựng nhân vật đứng trước bàn thờ |
| `altar-and-sanctuary-backdrop.jpg` | Hậu cảnh bàn thờ, bình phong và hoa văn |
| `ceiling-painted-panel.jpg` | Texture trần vẽ Phật giáo |
| `ceiling-lotus-mandala.jpg` | Họa tiết hoa sen/mạn-đà-la trên trần |
| `hanging-lantern.png` | Đèn lồng treo |
| `carved-temple-column.png` | Cột gỗ sơn son thếp vàng |
| `red-lotus-carpet.png` | Thảm đỏ lối đi |
| `flowering-trees.png` | Cây mai/cây đào trang trí |
| `altar-offerings.png` | Lư hương, nến, hoa quả |
| `ritual-instruments.png` | Mõ và pháp khí |
| `side-decorations.jpg` | Cụm trang trí hai bên |
| `courtyard-floor.jpg` | Sàn gạch và lối đi |
| `altar-front-platform.jpg` | Mặt trước bàn/bệ thờ |
| `golden-light-rays.jpg` | Tham chiếu ánh sáng vàng |

## Lưu ý độ chính xác
Ảnh tách được lấy từ asset sheet AI được tạo dựa trên screenshot, nên giữ đúng ngôn ngữ màu sắc/bố cục tổng thể nhưng không thể cam kết trùng pixel 100% với screenshot gốc. Muốn khớp tuyệt đối cần dựng lại theo kích thước/điểm neo của scene gốc và kiểm tra screenshot render.

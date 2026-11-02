# Bộ asset Chánh Điện 3D — v1

Bộ ảnh tách từ asset sheet tham chiếu để dựng nhanh scene Three.js 9:16.

## Cài vào repository

Giải nén file `linh-ung-3d-asset-kit-v1.zip`, sau đó chép thư mục `temple-kit` vào:

```
public/assets/temple-kit/
```

## Thành phần
- `buddha-statue.png`, `abbot-monk.png`: ảnh RGBA tách nền, dùng làm tham chiếu dựng mesh/GLB hoặc billboard trong góc camera cố định.
- `altar-and-sanctuary-backdrop.jpg`: hậu cảnh bàn thờ.
- `ceiling-painted-panel.jpg`, `ceiling-lotus-mandala.jpg`: texture tham chiếu trần và hoa văn Phật giáo.
- `hanging-lantern.png`, `carved-temple-column.png`: đèn lồng và cột.
- `red-lotus-carpet.png`, `courtyard-floor.jpg`: thảm đỏ và nền gạch.
- `flowering-trees.png`, `altar-offerings.png`, `ritual-instruments.png`, `side-decorations.jpg`: các cụm trang trí/pháp khí.
- `altar-front-platform.jpg`, `golden-light-rays.jpg`: bệ bàn thờ và tham chiếu ánh sáng.

## Quy tắc tích hợp
1. Ưu tiên dùng ảnh trần/hậu cảnh/thảm làm texture trên mesh có UV, không dán phẳng toàn cảnh lên camera.
2. Tượng Phật cần GLB có chiều sâu để đúng phối cảnh và không méo khi đổi góc; ảnh PNG chỉ là reference.
3. Trụ trì cần dựng thành nhân vật 3D rigged/mesh để có thể idle/breathing và đứng đúng trước bàn thờ.
4. Không thay các mesh đang chạy trước khi có ảnh render so sánh và xác nhận không che lối đi/bàn thờ.

## Giới hạn độ chính xác
Bộ ảnh được tách từ asset sheet AI dựa trên screenshot, không phải bản sao pixel-perfect. Muốn khớp 100% cần dựng lại theo screenshot gốc, giữ đúng camera, kích thước, điểm neo và kiểm tra render thực tế.

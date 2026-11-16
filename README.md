# Custom Your Antigravity

<p align="center">
  <strong>Tùy biến toàn diện cho Google Antigravity Desktop (Windows)</strong><br>
  Tích hợp <strong>Custom Themes & Wallpapers</strong> cùng bộ quản lý <strong>Custom AI Providers & Models</strong> trong một trình cài đặt duy nhất.
</p>

<p align="center">
  <a href="https://github.com/khanhlop11/custom-your-antigravity"><img src="https://img.shields.io/badge/GitHub-khanhlop11%2Fcustom--your--antigravity-blue?logo=github" alt="GitHub Repo"></a>
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows" alt="Platform Windows">
  <img src="https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js 22+">
  <img src="https://img.shields.io/badge/License-Apache--2.0-2563eb" alt="License Apache-2.0">
</p>

---

## 🌟 Tính năng nổi bật

### 1. 🎨 Custom Themes & Wallpapers
- **Local Wallpaper Engine**: Thêm hình nền cá nhân cục bộ qua giao thức nội bộ `agy-theme://wallpaper/` (hỗ trợ `PNG`, `JPG`, `WebP`, `GIF`, `BMP`).
- **Thanh trượt Glassmorphism & Độ trong suốt độc lập**:
  - Độ mờ và làm tối hình nền (Background Dim & Blur).
  - Độ trong suốt & hiệu ứng kính mờ cho Left Sidebar.
  - Độ trong suốt & hiệu ứng kính mờ cho khung nhập Prompt (Composer).
  - Độ trong suốt & hiệu ứng kính mờ cho thanh bên phải / bảng Swarm.
- **8 Preset Bong bóng Chat**: `Default`, `Charcoal Cat`, `Galaxy`, `Scroll`, `Jade Dragon`, `Moon Witch`, `Fox`, `Frost Glass`.
- **4 Preset Khung nhập Prompt**: `Frosted Glass`, `Neon Glow`, `Floating Pill`, `Minimal Flat`.
- **Tùy chỉnh trực tiếp trong Settings**: Thêm tab **Custom Theme** ngay trong mục Cài đặt của Antigravity, tự động cập nhật ngay lập tức mà không cần khởi động lại app.

### 2. 🤖 Custom AI Providers & Models
- **Hỗ trợ thêm nhà cung cấp ngoài**: OpenAI, Anthropic, Ollama, DeepSeek, OpenRouter, Google Account Pools...
- **Tích hợp Native Model Picker**: Chọn và chuyển đổi model trực tiếp ngay trong giao diện chat của Antigravity.
- **Tương thích hoàn toàn với Multi-Agent (`/swarm`)**: Các worker subagent có thể gọi và chạy trên các model tùy chỉnh mượt mà.
- **Nút Update Now thông minh**: Sau khi thêm hoặc xóa model, xuất hiện thông báo và nút **🔄 Update now** nổi bật để bạn chủ động khởi động lại Antigravity khi các tác vụ agent đang chạy hoàn tất (tránh bị gián đoạn giữa chừng).

### 3. 🛡️ An toàn & Có thể khôi phục 100%
- Tự động sao lưu `app.asar` nguyên bản với mã băm SHA-256.
- Hỗ trợ gỡ cài đặt sạch sẽ, trả lại nguyên trạng file gốc bất cứ lúc nào.

---

## 🚀 Cài đặt (Installation)

### Yêu cầu:
- Ứng dụng **Antigravity Desktop** trên Windows (tại `%LOCALAPPDATA%\Programs\antigravity`).
- **PowerShell** (Node.js 22 trở lên).

### Các bước cài đặt:

1. Đóng hẳn ứng dụng Antigravity (nếu ứng dụng đang chạy).
2. Mở PowerShell tại thư mục này và chạy lệnh:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

*(Script sẽ tự động đóng các tiến trình Antigravity còn chạy ngầm, áp dụng bản vá tích hợp cả Themes lẫn Model Provider và kiểm tra tính toàn vẹn).*

---

## ⚙️ Hướng dẫn sử dụng

### 1. Tùy chỉnh Giao diện & Hình nền
Vào **Settings** (Cài đặt) -> Chọn tab **Custom Theme** ở cột bên trái:
- **Tải ảnh nền**: Nhấn **Upload Wallpaper** hoặc kéo thả ảnh vào khung.
- **Điều chỉnh thanh trượt**: Kéo các thanh trượt Dim/Blur/Opacity theo ý thích để tạo hiệu ứng kính mờ.
- **Chọn Preset**: Bấm chọn preset giao diện chat và khung nhập yêu thích.

### 2. Thêm Model AI mới
Vào **Settings** -> Mục **Custom Models**:
- Bấm **Add Model** -> Chọn nhà cung cấp (OpenAI, Claude, Ollama, v.v.).
- Nhập API Key, Base URL và Model ID -> Bấm **Save**.
- Sau khi lưu, bấm nút **🔄 Update now** hiển thị trên thanh công cụ để Antigravity nạp model mới cho danh sách chat và `/swarm`.

---

## 🔄 Gỡ cài đặt (Uninstallation)

Để gỡ bỏ hoàn toàn bản vá và khôi phục Antigravity về trạng thái nguyên bản của nhà phát hành:

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
```

---

## 👤 Tác giả

Phát triển và bảo trì bởi **[khanhlop11](https://github.com/khanhlop11)**.
Mã nguồn phát hành theo giấy phép [Apache-2.0](LICENSE).

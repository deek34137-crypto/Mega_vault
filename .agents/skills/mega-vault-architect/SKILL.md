---
name: mega-vault-architect
description: Master architectural, zero-storage security, API streaming, SQLite caching, and UI/UX Pro Max guidelines for the Mega Vault application.
---

# Mega Vault Architectural & Engineering Guidelines

## 🛡️ Core Security & Zero-Storage Principles
1. **Zero-Storage Policy**: Never download or write raw user media files to local server disk. Media items are fetched on-the-fly and streamed directly to the client browser via `/api/mega/stream` and `/api/mega/zip`.
2. **Encrypted Link Handling**: Shared MEGA folder URLs and decryption keys are parsed dynamically. Decrypted metadata is cached in `megavault.db` (LibSQL / SQLite) while raw streams are piped ephemerally.
3. **Session & Data Protection**: Keep user authorization secured via HTTP-only cookie JWT tokens (`/api/auth/login`). Sanitized folder backup data is mirrored to client `localStorage` (`megavault_saved_links`) to ensure zero data loss across container restarts.

---

## 🎨 UI/UX Pro Max & Design System Rules
1. **Obsidian Canvas Atmosphere**:
   - Base background: `#030712` obsidian dark mode with multi-point radial mesh glows (blue, vault indigo, emerald).
   - Glassmorphic panels: `glass-panel` (`backdrop-blur-2xl`, `bg-zinc-950/75`, `border-white/10`).
   - Glowing hover states: `glass-panel-hover` (`hover:border-blue-500/40`, `hover:shadow-[0_0_25px_rgba(59,130,246,0.15)]`).
2. **Micro-Animations & Feedback**:
   - Use Framer Motion for modal transitions, toast drop-ins, and card hover scale (`whileHover={{ y: -3, scale: 1.02 }}`).
   - Non-blocking glassmorphic Toast notifications (`useToast` & `ToastContainer`) instead of standard browser popups.
   - Shimmer skeleton loaders (`shimmer-effect`) during media image fetching.
3. **Keyboard Shortcuts & Hotkeys**:
   - `/` or `Ctrl+K`: Focus search bar immediately.
   - `Space`: Play/pause slideshow or video playback.
   - `F`: Fullscreen toggle.
   - `[` / `]`: Previous / Next item in lightbox or video player.
   - `Esc`: Close lightbox or modal overlay.
4. **Responsive Breakpoints**:
   - Mobile (`xs`: `<640px`): Touch targets ≥44px, compact multi-select action bars, dynamic mobile drawer navigation.
   - Tablet (`sm`/`md`: `640px`–`1024px`): Multi-column grids (`grid-cols-2` to `grid-cols-4`).
   - Desktop (`lg`/`xl`: `1024px+`): Full multi-column grids (`grid-cols-3` to `grid-cols-6`), expanded header action controls.

---

## 📡 API & Database Contracts
* **`GET /api/albums`**: List all indexed albums and subfolder trees.
* **`POST /api/albums`**: Index a new shared MEGA folder link.
* **`GET /api/albums/[id]/media?folder=...`**: Retrieve media items for a specific album or subfolder.
* **`GET /api/mega/stream?albumId=...&handle=...`**: Direct decrypted streaming endpoint for photos/videos.
* **`GET /api/mega/zip?albumId=...`**: Streaming ZIP packager for batch media downloads.
* **`GET /api/favorites` & `POST /api/favorites`**: Manage persistent starred media items and folders.

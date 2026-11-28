# PR Backlog: Upgrade & Fix Canvas Workspace

Catatan kerjaan lanjutan buat tim biar Canvas makin mateng, rapi, dan ga ada glitch UI pas dipakai bareng chat.

---

## 1. Redesign Canvas
- Rapihin visual hierarchy panel Canvas biar makin clean, konsisten sama gaya ChatGPT Canvas / Claude Artifacts, dan ga terasa rame.
- Poles spacing header, switcher file, tab Edit / Preview / Diff, dan empty state biar tetap enak dilihat di desktop maupun HP.
- Rapihin animasi buka-tutup panel & transisi tab (pakai GSAP tipis-tipis aja, jangan lebay).

## 2. Perbaiki Editor Canvas Code
- Benerin sinkronisasi scroll antara `<textarea>` input dan overlay syntax highlight Shiki (kadang masih geser atau offset pas file panjang / baris ke-wrap).
- Benerin posisi kursor, line numbers gutter, dan performa render pas AI lagi live streaming nulis kode panjang.
- Pastikan shortcut edit (Tab indent, undo/redo, copy, format dasar) jalan mulus di desktop & mobile.

## 3. Perbanyak Ekstensi / Kemampuan Desain PPTX untuk AI
- Tambahin lebih banyak layout & komponen desain di schema JSON `.pptx`, `SlidesCanvasEditor`, dan `exporters.ts` (misalnya layout timeline, comparison 2-3 kolom, tabel data rapi, visual card/badge, accent shapes, palet warna & tipografi lebih variatif).
- Update system prompt & tool description di `agent-tools.ts` supaya AI bisa bikin slide presentasi yang beneran niat dan estetik (bukan cuma judul + bullet polos).
- Pastiin semua elemen desain baru tersebut ikut ter-export rapi ke file `.pptx` asli saat di-download.

## 4. Perbaiki Textarea Chat yang Tidak Responsive Saat Canvas Dibuka
- Benerin lebar dan flex layout `ChatComposer` di `ChatView` pas panel Canvas kebuka (terutama di layar laptop kecil, tablet, atau saat panel Canvas di-resize agak lebar).
- Pastiin textarea auto-grow, tombol tools (`+`), model selector, dan action bar tetap proporsional dan tidak kepotong atau numpuk.

## 5. Perbaiki Bentrokan Canvas dengan Tombol Kirim di Textarea
- Benerin bug layout / `z-index` / positioning di `ChatView`, `ChatComposer`, dan `CanvasPanel` supaya tombol kirim (`Send`) di textarea tidak ketiban panel Canvas atau malah masuk/nyasar ke dalam area Canvas saat split-view aktif maupun pas transisi buka-tutup.
- Cek ulang container `min-w-0`, `overflow-hidden`, dan sticky/fixed positioning di desktop + mobile sheet biar area chat dan area Canvas beneran terpisah bersih.

# Deploy Ludo Multiplayer

Proyek sudah siap deploy. Local git sudah di-init dan commit pertama sudah dibuat.

## Status Lokal
- ✅ Git initialized
- ✅ `.gitignore` dibuat
- ✅ Commit pertama: `34f08f2 feat: Ludo multiplayer with PRD upgrades (F1-F10, F12)`
- ✅ Build verified: `npx vite build` → 0 errors, 276.82 kB JS (gz 84.63 kB)

## Kenapa Tidak Auto-Push?
Butuh kredensial yang TIDAK boleh disimpan di tool:
- **GitHub**: Personal Access Token (PAT) atau SSH key
- **Vercel**: Token deploy

## Opsi Deploy (Pilih Salah Satu)

### Opsi A — Vercel Dashboard (Paling Gampang, 2 menit)
1. Buka https://github.com/new
2. Login dengan akun `begolo111@gmail.com`
3. Buat repo baru:
   - Name: `ludo-multiplayer`
   - Visibility: Public (atau Private)
   - **JANGAN** centang "Add README", "Add .gitignore", "Add license"
4. Klik "Create repository"
5. Di terminal, jalankan (ganti `begolo111` dengan username GitHub Anda):
   ```powershell
   cd "c:\Users\irvan\Documents\GAMELUDO-DEEPSEEK\ludo-multiplayer"
   git remote add origin https://github.com/begolo111/ludo-multiplayer.git
   git branch -M main
   git push -u origin main
   ```
6. Buka https://vercel.com/new
7. Klik "Import" di repo `ludo-multiplayer`
8. Klik "Deploy" (Vite terdeteksi otomatis)
9. Selesai — Vercel kasih URL publik

### Opsi B — Vercel CLI dengan Token
1. Buka https://github.com/settings/tokens → Generate new token (classic)
   - Scope: `repo` (full)
   - Copy token
2. Buat repo kosong di https://github.com/new (lihat Opsi A langkah 1-4)
3. Di terminal PowerShell:
   ```powershell
   cd "c:\Users\irvan\Documents\GAMELUDO-DEEPSEEK\ludo-multiplayer"
   $env:GITHUB_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxx"
   git remote add origin https://github.com/begolo111/ludo-multiplayer.git
   git push https://$env:GITHUB_TOKEN@github.com/begolo111/ludo-multiplayer.git main
   ```
4. Buka https://vercel.com/account/tokens → Create token
5. Deploy:
   ```powershell
   $env:VERCEL_TOKEN = "xxxxxxxxxxxxxxxxxxxx"
   npx vercel deploy --prod --yes --token $env:VERCEL_TOKEN
   ```
6. Ikuti prompt pertama kali (nama project, dll.)

### Opsi C — Deploy Lokal Dulu, GitHub Nanti
Vercel bisa deploy langsung dari folder lokal:
1. Buka https://vercel.com/account/tokens → Create token
2. Di terminal:
   ```powershell
   cd "c:\Users\irvan\Documents\GAMELUDO-DEEPSEEK\ludo-multiplayer"
   npx vercel deploy --prod --yes --token <paste_token_disini>
   ```

## Catatan Penting
- File `dist/` sudah di-ignore (build output)
- Vercel otomatis jalankan `npm run build` saat deploy
- SPA routing: Vercel serve `index.html` untuk semua route (sudah default)
- PeerJS perlu signaling server — Vercel serve static only, signaling pakai server PeerJS publik (sudah hardcode di `useMultiplayer.js`)
- WebRTC butuh HTTPS — Vercel kasih HTTPS otomatis ✅

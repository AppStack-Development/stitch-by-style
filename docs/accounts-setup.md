# ตั้งค่าระบบบัญชี (Supabase + Google) / Accounts setup

> **เปลี่ยนชื่อ (20 พ.ย. 2569):** แอปชื่อ Cross Stitch Lab ที่ https://cross-stitch-lab.vercel.app (โดเมนเดิม stitch-by-style.vercel.app ยังอยู่และส่งผู้ใช้ไปโดเมนใหม่พร้อมข้อมูลในเครื่อง ดู src/lib/domainMove.ts) ชื่อโปรเจกต์ Supabase / Google Cloud ยังเป็น `stitch-by-style`
>
> **สถานะ (19 พ.ย. 2569):** ตั้งค่าเสร็จแล้ว — Supabase project `stitch-by-style` (AppStack-Dev, Singapore),
> Google Cloud project `stitch-by-style` (appstack-dev.io, OAuth client "Stitch by Style web", In production).
> ค่าสาธารณะอยู่ใน `.env.production` แล้ว เอกสารนี้เก็บไว้สำหรับตั้งค่าใหม่หรือย้ายโปรเจกต์

ระบบบัญชีเป็น **ทางเลือก** จะเปิดใช้ก็ต่อเมื่อมีค่า `VITE_SUPABASE_URL` และ `VITE_SUPABASE_KEY`
ถ้ายังไม่ใส่ เว็บทำงานแบบเดิมทุกอย่าง (เก็บข้อมูลในเบราว์เซอร์) และไม่มีปุ่มเข้าสู่ระบบ

ขั้นตอนด้านล่างต้องทำโดย **แอดมินของบริษัท** เพราะต้องตั้งรหัสผ่านฐานข้อมูล และใส่ secret ของ Google เอง

## 1. สร้างโปรเจกต์ Supabase

1. เข้า <https://supabase.com/dashboard> ด้วยบัญชีแอดมินของบริษัท แล้วสร้าง organization ของบริษัท (ถ้ายังไม่มี)
2. **New project**
   - Name: `stitch-by-style`
   - Region: **Southeast Asia (Singapore)** (ใกล้ผู้ใช้ในไทยที่สุด)
   - Database password: ตั้งรหัสที่เดายาก แล้วเก็บไว้ในตัวจัดการรหัสผ่านของบริษัท (แอปไม่ได้ใช้รหัสนี้)
   - Plan: Free ก็พอสำหรับช่วงแรก (โปรเจกต์ฟรีจะหยุดชั่วคราวถ้าไม่มีการใช้งานนาน ๆ)
3. เมนู **SQL Editor** → New query → วางเนื้อหาไฟล์ [`supabase/migrations/0001_accounts.sql`](../supabase/migrations/0001_accounts.sql) ทั้งหมด → **Run**
   - สร้างตาราง `profiles`, `patterns`, `stashes` พร้อม row-level security (ผู้ใช้เห็นได้เฉพาะข้อมูลของตัวเอง) และฟังก์ชันลบบัญชี
4. เมนู **Project Settings → API Keys / Data API** คัดลอก 2 ค่า
   - **Project URL** เช่น `https://abcdefgh.supabase.co`
   - **Publishable key** (หรือ anon key) ค่านี้ออกแบบมาให้อยู่ในเว็บได้ ปลอดภัยเพราะมี row-level security
   - ⚠️ ห้ามใช้ `service_role` / secret key ในเว็บ

## 2. ตั้งค่าเข้าสู่ระบบด้วย Google

1. เข้า <https://console.cloud.google.com> ด้วยบัญชีของบริษัท → สร้างโปรเจกต์ `Stitch by Style`
2. **Google Auth Platform → Branding** (หรือ OAuth consent screen)
   - User type: **External**
   - App name: `Stitch by Style`, support email และ developer contact เป็นอีเมลของบริษัท
   - App home page: `https://cross-stitch-lab.vercel.app`
   - Privacy policy: `https://cross-stitch-lab.vercel.app/#/privacy`
   - Scopes: ใช้แค่ค่าพื้นฐาน `openid`, `email`, `profile` (ไม่ต้องขอ scope อื่น)
3. **Clients → Create client** → Application type: **Web application**
   - Authorized JavaScript origins: `https://cross-stitch-lab.vercel.app` และ `http://localhost:5173`
   - Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`
     (คัดลอก URL นี้ได้จาก Supabase → Authentication → Sign In / Providers → Google)
   - กด Create แล้วเก็บ **Client ID** และ **Client secret**
4. **Audience** → กด **Publish app** เพื่อให้ทุกบัญชี Gmail เข้าสู่ระบบได้ (ถ้าไม่กด จะเข้าได้เฉพาะ test users)

## 3. เชื่อม Google เข้ากับ Supabase

1. Supabase → **Authentication → Sign In / Providers → Google** → Enable → วาง Client ID และ Client secret → Save
2. Supabase → **Authentication → URL Configuration**
   - Site URL: `https://cross-stitch-lab.vercel.app`
   - Redirect URLs: `https://cross-stitch-lab.vercel.app/**` และ `http://localhost:5173/**`

## 4. เปิดใช้ในเว็บ

1. ใส่ค่าใน `.env.production` (commit ได้ เพราะเป็นค่าสาธารณะ) หรือตั้งใน Vercel → Settings → Environment Variables
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_KEY` = Publishable key
2. Push commit ใหม่ ค่าจะถูกฝังตอน build
3. เครื่องนักพัฒนา: สร้างไฟล์ `.env.local` (ไม่ขึ้น git) ตามตัวอย่างใน `.env.example`

## 5. ก่อนเปิดให้ใช้จริง

- ใส่อีเมลติดต่อในหน้านโยบายความเป็นส่วนตัว (`CONTACT_EMAIL` ใน `src/pages/Privacy.tsx`) ตาม PDPA
- ทดสอบ: เข้าสู่ระบบบนคอม สร้างลาย → เข้าสู่ระบบบนมือถือด้วยบัญชีเดียวกัน → ลายต้องขึ้นมา

# SchoolPay 🪙 — Economía Escolar Gamificada con NFC

Sistema completo de economía virtual para el salón de clases.
Tarjetas NFC físicas · Firebase Firestore offline-first · Next.js 14 · Tailwind CSS

---

## Mapa de URLs

| URL | Quién | Descripción |
|-----|-------|-------------|
| `/` | Docente | Panel principal con escáner NFC y acciones rápidas |
| `/students` | Docente | CRUD completo de alumnos, ver PINs, resetear PINs |
| `/nfc-writer` | Docente | Escritura NFC guiada sticker por sticker |
| `/print` | Docente | Tarjetas imprimibles CR80 con opción raspadito para PIN |
| `/portal` | Alumno | Login con ID+PIN → Saldo, Tienda, Mis órdenes |

---

## Setup paso a paso

### 1. Crear proyecto Firebase

1. console.firebase.google.com → Crear proyecto
2. Authentication → Sign-in method → Habilitar: Google + Email/Password
3. Firestore Database → Crear → Modo producción
4. Project settings → Your apps → Add web app → Copiar credenciales

### 2. Variables de entorno

```bash
cp .env.local.example .env.local
```

Rellena `.env.local` con tus credenciales de Firebase y tu email de docente.

### 3. Reglas de Firestore

Edita `firestore.rules` → reemplaza `TU_EMAIL_AQUI@gmail.com` → pega en
Firebase Console → Firestore → Reglas → Publicar.

### 4. Instalar y correr

```bash
npm install
npm run dev
```

### 5. Deploy en Vercel (necesario para NFC)

```bash
npm run build
npx vercel
```

Agrega estas variables en Vercel Dashboard → Project → Settings → Environment Variables:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_TEACHER_EMAIL`
- `NEXT_PUBLIC_GROUP_NAME`
- `NEXT_PUBLIC_SCHOOL_NAME`

Vercel detecta Next.js automáticamente. Usa:

- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: dejar vacío

### 6. Crear alumnos

Panel docente → Alumnos → + Nuevo alumno → "Apellido, Nombre"
El sistema genera el ID y PIN automáticamente.

### 7. Grabar los stickers NFC

Panel docente → Alumnos → Escribir NFC en serie → seguir el flujo guiado.

### 8. Imprimir tarjetas

Panel docente → Alumnos → Imprimir tarjetas → configurar y mandar a impresora.

---

## Estructura del proyecto

```
src/
├── types/index.ts              Todas las interfaces + helpers
├── lib/
│   ├── firebase.ts             Init singleton + app secundaria para alumnos
│   ├── auth.tsx                Context React teacher/student
│   └── firestore.ts            Toda la capa de datos
├── hooks/
│   ├── useNFC.ts               Web NFC API + writeNFCTag
│   └── useToast.ts             Notificaciones con undo
├── components/
│   ├── ui/index.tsx            Avatar, LevelBadge, Toast, NFCButton...
│   ├── teacher/                QuickActionsPanel, OrdersPanel, ConfigPanel
│   └── student/                LoginForm, Portal (store + history)
└── app/
    ├── page.tsx                Panel docente con escáner NFC
    ├── portal/page.tsx         Portal alumno (login + tienda)
    ├── students/page.tsx       Gestión de alumnos
    ├── nfc-writer/page.tsx     Escritura NFC guiada
    └── print/page.tsx          Tarjetas imprimibles CR80
```

---

## Costos

Todo en tier gratuito: Firebase Spark + Vercel Hobby = $0 MXN/mes.
Firebase Spark soporta 50K lecturas/día. Un grupo de 35 alumnos usa ~600 ops/día.

## Hardware

- Celular docente: OnePlus Nord N10 5G — NFC nativo, Android 11, Chrome 89+
- Stickers NFC: NTAG213 13.56 MHz 30mm — lote 100 pzas en MercadoLibre ~$2 c/u
- Tarjetas: Cartulina 300g laminada CR80 (85.6 x 54 mm)

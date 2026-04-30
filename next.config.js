/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite que la PWA funcione correctamente
  // Para NFC necesitamos HTTPS — Vercel lo provee automáticamente
  reactStrictMode: true,

  // Headers de seguridad recomendados
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

module.exports = nextConfig

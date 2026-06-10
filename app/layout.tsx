import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Protocolo Fiscal',
  description: 'Sistema de protocolo de notas fiscais',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-950 font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

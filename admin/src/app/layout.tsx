import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    template: "%s — Jeweler Admin",
    default: "Jeweler Admin",
  },
  description: "Dense ERP admin for jewelers — manage inventory, orders, SIP, and more.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="antialiased">{children}</body>
    </html>
  )
}

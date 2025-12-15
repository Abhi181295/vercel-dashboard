import './globals.css'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react' // Import the component

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Fitelo Dashboard',
  description: 'Revenue Management Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Analytics /> {/* Add this line here */}
      </body>
    </html>
  )
}
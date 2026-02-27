'use client'

import { PropertyProvider } from '@/app/context/PropertyContext'
import { Building2, Home, QrCode, Shield } from 'lucide-react'
import Link from 'next/link'

function DashboardHeader() {
  return (
    <div className="bg-gradient-to-r from-navy-900 to-navy-800 border-b border-navy-700 px-6 py-2">
      <div className="max-w-7xl mx-auto">
        {/* V10.8.1: Simplified header - removed complex property switcher UI */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: Shield + Title */}
          <div className="flex items-center gap-3">
            <div className="bg-teal-500/20 p-2 rounded-lg">
              <Shield className="w-5 h-5 text-teal-400" />
            </div>
            <h1 className="text-xl font-bold text-white whitespace-nowrap max-[850px]:text-lg">Secure Access Pass</h1>
          </div>
          
          {/* Right: Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium text-white max-[850px]:px-2"
            >
              <Home className="w-4 h-4" />
              <span className="max-[850px]:hidden">Home</span>
            </Link>
            <Link
              href="/scanner"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium text-white max-[850px]:px-2"
            >
              <QrCode className="w-4 h-4" />
              <span className="max-[850px]:hidden">Scanner</span>
            </Link>
            <Link
              href="/dashboard/portfolio"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium text-white max-[850px]:px-2"
            >
              <Building2 className="w-4 h-4" />
              <span className="max-[850px]:hidden">Portfolio</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PropertyProvider>
      <div className="min-h-screen bg-gradient-to-br from-navy-50 via-teal-50 to-navy-100">
        <DashboardHeader />
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </div>
    </PropertyProvider>
  )
}

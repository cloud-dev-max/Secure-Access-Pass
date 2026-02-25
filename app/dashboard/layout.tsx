'use client'

import { PropertyProvider, useProperty } from '@/contexts/PropertyContext'
import { Building2, ChevronDown, Home, QrCode, Shield } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

function PropertySwitcher() {
  const { currentProperty, properties, setCurrentProperty, isLoading } = useProperty()
  const [showDropdown, setShowDropdown] = useState(false)

  if (isLoading || !currentProperty) {
    return (
      <div className="bg-white/20 rounded-lg px-4 py-2">
        <div className="animate-pulse h-6 w-32 bg-white/30 rounded"></div>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="bg-white/20 hover:bg-white/30 rounded-lg px-4 py-2 flex items-center gap-2 transition-all"
      >
        <Building2 className="w-5 h-5 text-white" />
        <span className="text-white font-semibold">{currentProperty.property_name}</span>
        <ChevronDown className={`w-4 h-4 text-white transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {showDropdown && properties.length > 1 && (
        <div className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-2xl border border-navy-200 min-w-64 z-50">
          <div className="p-2">
            <div className="text-xs font-semibold text-navy-600 px-3 py-2">Switch Property</div>
            {properties.map((property) => (
              <button
                key={property.id}
                onClick={() => {
                  setCurrentProperty(property)
                  setShowDropdown(false)
                }}
                className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                  property.id === currentProperty.id
                    ? 'bg-teal-50 text-teal-900 font-semibold'
                    : 'text-navy-700 hover:bg-navy-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  <span>{property.property_name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DashboardHeader() {
  return (
    <div className="bg-gradient-to-r from-navy-900 to-navy-800 border-b border-navy-700 px-6 py-2">
      <div className="max-w-7xl mx-auto">
        {/* V9.18 Fix #1 & #2: Smart 2-Row Stacking - Desktop: 1 line, Below xl: 2 centered rows */}
        
        {/* Desktop view (xl and above): Single line */}
        <div className="hidden xl:flex items-center justify-between gap-3">
          {/* Left: Shield + Title */}
          <div className="flex items-center gap-3">
            <div className="bg-teal-500/20 p-2 rounded-lg">
              <Shield className="w-5 h-5 text-teal-400" />
            </div>
            <h1 className="text-xl font-bold text-white whitespace-nowrap">Secure Access Pass</h1>
          </div>
          
          {/* Right: Buttons + Property */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium text-white"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>
            <Link
              href="/scanner"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium text-white"
            >
              <QrCode className="w-4 h-4" />
              <span>Scanner</span>
            </Link>
            <Link
              href="/dashboard/portfolio"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium text-white"
            >
              <Building2 className="w-4 h-4" />
              <span>Portfolio</span>
            </Link>
            
            <PropertySwitcher />
          </div>
        </div>

        {/* Mobile/Tablet view (below xl): 2 centered rows */}
        <div className="xl:hidden space-y-2">
          {/* Row 1: Shield + Title (left) and Property (right) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-teal-500/20 p-2 rounded-lg">
                <Shield className="w-5 h-5 text-teal-400" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-white whitespace-nowrap">Secure Access Pass</h1>
            </div>
            <PropertySwitcher />
          </div>
          
          {/* Row 2: Action Buttons (centered) */}
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium text-white"
            >
              <Home className="w-4 h-4" />
              <span className="text-xs sm:text-sm">Home</span>
            </Link>
            <Link
              href="/scanner"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium text-white"
            >
              <QrCode className="w-4 h-4" />
              <span className="text-xs sm:text-sm">Scanner</span>
            </Link>
            <Link
              href="/dashboard/portfolio"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium text-white"
            >
              <Building2 className="w-4 h-4" />
              <span className="text-xs sm:text-sm">Portfolio</span>
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

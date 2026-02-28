'use client'

import { PropertyProvider } from '@/app/context/PropertyContext'
import { Building2, Home, QrCode, Shield, ChevronDown, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useContext, useState, useEffect } from 'react'
import { PropertyContext } from '@/app/context/PropertyContext'

function DashboardHeader() {
  const { propertyId, setPropertyId } = useContext(PropertyContext)
  const [currentPropertyName, setCurrentPropertyName] = useState<string>('Select Property')
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false)
  const [allProperties, setAllProperties] = useState<any[]>([])

  // V10.8.6: Load property name
  useEffect(() => {
    if (!propertyId) return
    
    fetch(`/api/properties?id=${propertyId}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setCurrentPropertyName(data[0].property_name || data[0].name)
        }
      })
      .catch(err => console.error('Failed to load property name:', err))
  }, [propertyId])

  // V10.8.6: Load all properties for dropdown
  useEffect(() => {
    fetch('/api/portfolio')
      .then(res => res.json())
      .then(data => {
        if (data && data.properties) {
          setAllProperties(data.properties)
        }
      })
      .catch(err => console.error('Failed to load properties:', err))
  }, [])

  // V10.8.6: Switch property
  const switchProperty = (newPropertyId: string, newPropertyName: string) => {
    setPropertyId(newPropertyId)
    setCurrentPropertyName(newPropertyName)
    localStorage.setItem('selectedPropertyId', newPropertyId)
    setShowPropertyDropdown(false)
  }

  return (
    <div className="bg-gradient-to-r from-navy-900 to-navy-800 text-white shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* V10.8.6: Unified responsive header */}
        <div className="py-3">
          {/* Row 1: Logo + Nav (desktop) OR Logo + Dropdown (mobile) */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Logo + Title */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Shield className="w-6 h-6 text-teal-400" />
              <h1 className="text-lg font-bold text-white whitespace-nowrap">Secure Access Pass</h1>
            </div>
            
            {/* Center: Nav Links (hidden on mobile < 768px) */}
            <div className="hidden md:flex items-center gap-2 flex-1 justify-center">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium flex items-center gap-1.5"
              >
                <Home className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <Link
                href="/scanner"
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium flex items-center gap-1.5"
              >
                <QrCode className="w-4 h-4" />
                <span>Scanner</span>
              </Link>
              <Link
                href="/dashboard/portfolio"
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium flex items-center gap-1.5"
              >
                <Building2 className="w-4 h-4" />
                <span>Portfolio</span>
              </Link>
            </div>
          
            {/* Right: Property Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowPropertyDropdown(!showPropertyDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all border border-white/20"
              >
                <Building2 className="w-4 h-4 text-teal-400" />
                <span className="text-sm font-semibold text-white max-w-[200px] truncate">
                  {currentPropertyName}
                </span>
                <ChevronDown className={`w-4 h-4 text-white transition-transform ${showPropertyDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Property Dropdown Menu */}
              {showPropertyDropdown && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-2xl border border-navy-200 z-50 max-h-96 overflow-y-auto">
                  <div className="p-2">
                    <div className="text-xs font-semibold text-navy-600 px-3 py-2 border-b border-navy-100">
                      Select Property
                    </div>
                    {allProperties.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-navy-500 text-center">
                        No properties found
                      </div>
                    ) : (
                      allProperties.map((property) => (
                        <button
                          key={property.id}
                          onClick={() => switchProperty(property.id, property.name)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                            property.id === propertyId
                              ? 'bg-teal-50 text-teal-900 font-semibold'
                              : 'text-navy-700 hover:bg-navy-50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <Building2 className={`w-4 h-4 mt-0.5 ${property.id === propertyId ? 'text-teal-600' : 'text-navy-400'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{property.name}</div>
                              <div className="text-xs text-navy-500 mt-0.5">
                                {property.currentOccupancy || 0}/{property.maxCapacity || 0} occupancy
                              </div>
                            </div>
                            {property.id === propertyId && (
                              <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="border-t border-navy-100 p-2">
                    <Link
                      href="/dashboard/portfolio"
                      className="block w-full text-center px-3 py-2 text-sm text-teal-600 hover:bg-teal-50 rounded-lg transition-all font-medium"
                      onClick={() => setShowPropertyDropdown(false)}
                    >
                      View Full Portfolio →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Row 2: Mobile Nav Links (visible only on mobile < 768px) */}
          <div className="md:hidden flex items-center justify-center gap-2 mt-3 pt-3 border-t border-white/10">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium flex items-center gap-1.5"
            >
              <Home className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/scanner"
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium flex items-center gap-1.5"
            >
              <QrCode className="w-4 h-4" />
              <span>Scanner</span>
            </Link>
            <Link
              href="/dashboard/portfolio"
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium flex items-center gap-1.5"
            >
              <Building2 className="w-4 h-4" />
              <span>Portfolio</span>
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
      <DashboardHeader />
      {children}
    </PropertyProvider>
  )
}

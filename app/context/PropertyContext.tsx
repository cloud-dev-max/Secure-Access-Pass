'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface PropertyContextType {
  activePropertyId: string
  setActivePropertyId: (id: string) => void
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined)

export function PropertyProvider({ children }: { children: ReactNode }) {
  const [activePropertyId, setActivePropertyId] = useState<string>(
    process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'
  )

  return (
    <PropertyContext.Provider value={{ activePropertyId, setActivePropertyId }}>
      {children}
    </PropertyContext.Provider>
  )
}

export function useProperty() {
  const context = useContext(PropertyContext)
  if (context === undefined) {
    throw new Error('useProperty must be used within a PropertyProvider')
  }
  return context
}

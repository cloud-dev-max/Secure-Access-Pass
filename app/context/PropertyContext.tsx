'use client'

import React, { createContext, useState, ReactNode } from 'react'

export interface PropertyContextType {
  propertyId: string | null
  setPropertyId: (id: string) => void
}

export const PropertyContext = createContext<PropertyContextType>({
  propertyId: null,
  setPropertyId: () => {},
})

export function PropertyProvider({ children }: { children: ReactNode }) {
  const [propertyId, setPropertyId] = useState<string | null>(null)

  return (
    <PropertyContext.Provider value={{ propertyId, setPropertyId }}>
      {children}
    </PropertyContext.Provider>
  )
}

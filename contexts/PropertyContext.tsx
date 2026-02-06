'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface Property {
  id: string
  name: string
  property_name: string
  owner_id: string | null
}

interface PropertyContextType {
  currentProperty: Property | null
  properties: Property[]
  setCurrentProperty: (property: Property) => void
  loadProperties: () => Promise<void>
  isLoading: boolean
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined)

export function PropertyProvider({ children }: { children: ReactNode }) {
  const [currentProperty, setCurrentProperty] = useState<Property | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadProperties = async () => {
    setIsLoading(true)
    try {
      // V5: Fetch all properties for the current owner
      // For now, we'll fetch all properties and filter by owner_id in the future
      const response = await fetch('/api/properties')
      if (response.ok) {
        const data = await response.json()
        setProperties(data)
        
        // Set current property from localStorage or default to first
        const savedPropertyId = localStorage.getItem('current_property_id')
        if (savedPropertyId) {
          const saved = data.find((p: Property) => p.id === savedPropertyId)
          if (saved) {
            setCurrentProperty(saved)
            return
          }
        }
        
        // Default to first property or use default from env
        const defaultId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'
        const defaultProp = data.find((p: Property) => p.id === defaultId) || data[0]
        if (defaultProp) {
          setCurrentProperty(defaultProp)
          localStorage.setItem('current_property_id', defaultProp.id)
        }
      }
    } catch (error) {
      console.error('Error loading properties:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProperties()
  }, [])

  const handleSetCurrentProperty = (property: Property) => {
    setCurrentProperty(property)
    localStorage.setItem('current_property_id', property.id)
    // Trigger page reload to refresh all data with new property
    window.location.reload()
  }

  return (
    <PropertyContext.Provider
      value={{
        currentProperty,
        properties,
        setCurrentProperty: handleSetCurrentProperty,
        loadProperties,
        isLoading,
      }}
    >
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

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, TrendingUp, Users, DollarSign, ArrowLeft, Activity, Plus, X } from 'lucide-react'

interface GlobalKPIs {
  totalOccupancy: number
  totalTodaysRevenue: number
  totalActiveResidents: number
  totalProperties: number
}

interface PropertyStats {
  id: string
  name: string
  status: 'Open' | 'Closed'
  currentOccupancy: number
  maxCapacity: number
  occupancyRatio: string
  todaysRevenue: number
  activeResidents: number
  guestPassPrice: number
}

interface PortfolioData {
  globalKPIs: GlobalKPIs
  properties: PropertyStats[]
}

export default function PortfolioDashboard() {
  const router = useRouter()
  const [data, setData] = useState<PortfolioData | null>(null)
  const [loading, setLoading] = useState(true)
  
  // V10.8.11: Add Property modal state
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false)
  const [newPropertyName, setNewPropertyName] = useState('')
  const [newPropertyCapacity, setNewPropertyCapacity] = useState('50')
  const [isCreatingProperty, setIsCreatingProperty] = useState(false)

  const loadPortfolioData = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      
      const response = await fetch('/api/portfolio')
      if (!response.ok) throw new Error('Failed to fetch portfolio data')
      
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error loading portfolio data:', error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // V9.0: Load on mount + 60s polling
  useEffect(() => {
    loadPortfolioData()
    
    const interval = setInterval(() => {
      loadPortfolioData(true) // Silent refresh
    }, 60000)
    
    return () => clearInterval(interval)
  }, [])

  const navigateToProperty = (propertyId: string) => {
    // Store selected property ID and navigate to main dashboard
    localStorage.setItem('selectedPropertyId', propertyId)
    router.push('/dashboard')
  }
  
  // V10.8.11: Create new property
  const createProperty = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newPropertyName.trim() || !newPropertyCapacity) {
      alert('Please fill in all fields')
      return
    }
    
    setIsCreatingProperty(true)
    
    try {
      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPropertyName.trim(),
          max_capacity: parseInt(newPropertyCapacity)
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to create property')
      }
      
      const newProperty = await response.json()
      console.log('[V10.8.11] Created property:', newProperty.name)
      
      // Reset form
      setNewPropertyName('')
      setNewPropertyCapacity('50')
      setShowAddPropertyModal(false)
      
      // Reload portfolio data
      await loadPortfolioData()
      
      alert(`Property "${newProperty.name}" created successfully!`)
    } catch (error) {
      console.error('Error creating property:', error)
      alert('Failed to create property. Please try again.')
    } finally {
      setIsCreatingProperty(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-navy-600"></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No portfolio data available</p>
        </div>
      </div>
    )
  }

  const { globalKPIs, properties } = data

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* V10.8.6: Simplified header - removed large title block */}
        {/* V10.8.11: Added Add Property button */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors bg-white border border-gray-200 shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-navy-600" />
          </button>
          
          <button
            onClick={() => setShowAddPropertyModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span>Add New Property</span>
          </button>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Occupancy */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total Occupancy</span>
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-navy-900">{globalKPIs.totalOccupancy}</div>
            <p className="text-xs text-gray-500 mt-1">People across all properties</p>
          </div>

          {/* Total Today's Revenue */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Today's Revenue</span>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-navy-900">${globalKPIs.totalTodaysRevenue.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">Total revenue today</p>
          </div>

          {/* Total Active Residents */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Active Residents</span>
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-navy-900">{globalKPIs.totalActiveResidents}</div>
            <p className="text-xs text-gray-500 mt-1">Residents portfolio-wide</p>
          </div>

          {/* Total Properties */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Properties</span>
              <Building2 className="w-5 h-5 text-teal-600" />
            </div>
            <div className="text-3xl font-bold text-navy-900">{globalKPIs.totalProperties}</div>
            <p className="text-xs text-gray-500 mt-1">Managed locations</p>
          </div>
        </div>

        {/* Properties Grid */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-navy-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-navy-600" />
              Property Performance Overview
            </h2>
            <p className="text-sm text-gray-600 mt-1">Click any property to view detailed analytics</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Property Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Occupancy
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Capacity Utilization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Today's Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Active Residents
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {properties.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">No properties found</p>
                      <p className="text-sm text-gray-500 mt-1">Add properties to start managing your portfolio</p>
                    </td>
                  </tr>
                ) : (
                  properties.map((property) => (
                    <tr
                      key={property.id}
                      onClick={() => navigateToProperty(property.id)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-navy-600" />
                          <span className="font-medium text-navy-900">{property.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            property.status === 'Open'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {property.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <span className="font-medium text-navy-900">{property.currentOccupancy}</span>
                          <span className="text-gray-500"> / {property.maxCapacity}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                parseInt(property.occupancyRatio) >= 90
                                  ? 'bg-red-500'
                                  : parseInt(property.occupancyRatio) >= 70
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(parseInt(property.occupancyRatio), 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700">{property.occupancyRatio}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-navy-900">${property.todaysRevenue.toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-purple-600" />
                          <span className="font-medium text-navy-900">{property.activeResidents}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* V10.8.6: Footer - removed V9.0 version text */}
        <div className="bg-gradient-to-r from-navy-800 to-navy-900 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Enterprise Portfolio Edition</h3>
              <p className="text-navy-200 text-sm mt-1">
                Multi-facility management • Real-time analytics • Comprehensive auditing
              </p>
            </div>
            <Building2 className="w-12 h-12 text-navy-400 opacity-50" />
          </div>
        </div>
      </div>
      
      {/* V10.8.11: Add Property Modal */}
      {showAddPropertyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-navy-900 flex items-center gap-2">
                <Plus className="w-6 h-6 text-teal-600" />
                Add New Property
              </h2>
              <button
                onClick={() => setShowAddPropertyModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={createProperty} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Property Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newPropertyName}
                  onChange={(e) => setNewPropertyName(e.target.value)}
                  placeholder="e.g., Willow Creek Community Pool"
                  required
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Capacity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={newPropertyCapacity}
                  onChange={(e) => setNewPropertyCapacity(e.target.value)}
                  placeholder="50"
                  required
                  min="1"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddPropertyModal(false)}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                  disabled={isCreatingProperty}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingProperty}
                  className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {isCreatingProperty ? 'Creating...' : 'Create Property'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

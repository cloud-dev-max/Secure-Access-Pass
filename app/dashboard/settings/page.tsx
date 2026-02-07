'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Settings, 
  Clock, 
  Users,
  DollarSign,
  Wrench,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Building2
} from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Form state
  const [propertyName, setPropertyName] = useState('Pool Access System') // V5: Customizable pool name
  const [operatingHoursStart, setOperatingHoursStart] = useState('06:00:00')
  const [operatingHoursEnd, setOperatingHoursEnd] = useState('22:00:00')
  const [maxCapacity, setMaxCapacity] = useState(50)
  const [guestPassPrice, setGuestPassPrice] = useState(5.00)
  const [maxGuestsPerResident, setMaxGuestsPerResident] = useState(3) // V5: Accompanying guest limit
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false)
  const [maintenanceReason, setMaintenanceReason] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings')
      
      if (!response.ok) {
        throw new Error('Failed to load settings')
      }

      const data = await response.json()
      
      setPropertyName(data.property_name || 'Pool Access System') // V5
      setOperatingHoursStart(data.operating_hours_start || '06:00:00')
      setOperatingHoursEnd(data.operating_hours_end || '22:00:00')
      setMaxCapacity(data.max_capacity || 50)
      setGuestPassPrice(data.guest_pass_price || 5.00)
      setMaxGuestsPerResident(data.max_guests_per_resident || 3) // V5
      setIsMaintenanceMode(data.is_maintenance_mode || false)
      setMaintenanceReason(data.maintenance_reason || '')
    } catch (error) {
      console.error('Error loading settings:', error)
      setMessage({ type: 'error', text: 'Failed to load settings' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_name: propertyName, // V5
          operating_hours_start: operatingHoursStart,
          operating_hours_end: operatingHoursEnd,
          max_capacity: maxCapacity,
          guest_pass_price: guestPassPrice,
          max_guests_per_resident: maxGuestsPerResident, // V5
          is_maintenance_mode: isMaintenanceMode,
          maintenance_reason: isMaintenanceMode ? maintenanceReason : null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save settings')
      }

      setMessage({ type: 'success', text: 'Settings saved successfully!' })
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save settings' 
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-50 via-teal-50 to-navy-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-navy-600 animate-spin mx-auto mb-4" />
          <p className="text-navy-600 font-semibold">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-50 via-teal-50 to-navy-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 text-white shadow-xl">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-teal-500 p-3 rounded-xl">
                <Settings className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Facility Settings</h1>
                <p className="text-navy-200">Configure pool operating hours and policies</p>
              </div>
            </div>
            
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Message Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-semibold">{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* V5: Property Name */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="w-6 h-6 text-navy-600" />
              <h2 className="text-xl font-bold text-navy-900">Property Name</h2>
            </div>
            <p className="text-sm text-navy-600 mb-4">Customize your pool or property name (appears on digital ID cards)</p>
            
            <input
              type="text"
              value={propertyName}
              onChange={(e) => setPropertyName(e.target.value)}
              required
              maxLength={50}
              className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 bg-white"
              placeholder="e.g., Sunrise Condos Pool, Oak Park Recreation Center"
            />
            <p className="text-xs text-navy-500 mt-2">This name will appear on all digital ID cards and in the resident portal</p>
          </div>

          {/* Operating Hours */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-navy-600" />
              <h2 className="text-xl font-bold text-navy-900">Operating Hours</h2>
            </div>
            <p className="text-sm text-navy-600 mb-4">Set the daily opening and closing times for the pool</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">
                  Opening Time
                </label>
                <input
                  type="time"
                  value={operatingHoursStart}
                  onChange={(e) => setOperatingHoursStart(e.target.value + ':00')}
                  required
                  className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 bg-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">
                  Closing Time
                </label>
                <input
                  type="time"
                  value={operatingHoursEnd}
                  onChange={(e) => setOperatingHoursEnd(e.target.value + ':00')}
                  required
                  className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Max Capacity */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-6 h-6 text-navy-600" />
              <h2 className="text-xl font-bold text-navy-900">Maximum Capacity</h2>
            </div>
            <p className="text-sm text-navy-600 mb-4">Maximum number of people allowed in the pool area</p>
            
            <input
              type="number"
              min="1"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(parseInt(e.target.value) || 1)}
              required
              className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 bg-white"
              placeholder="e.g., 50"
            />
          </div>

          {/* V6: Visitor Pass Price (renamed from Guest Pass) */
          <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-6 h-6 text-navy-600" />
              <h2 className="text-xl font-bold text-navy-900">Visitor Pass Price</h2>
            </div>
            <p className="text-sm text-navy-600 mb-4">Price in USD for a 24-hour visitor pass (unlimited entry/exit for 24 hours)</p>
            
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={guestPassPrice}
                onChange={(e) => setGuestPassPrice(parseFloat(e.target.value) || 0)}
                required
                className="w-full pl-8 pr-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 bg-white"
                placeholder="5.00"
              />
            </div>
          </div>

          {/* V5: Accompanying Guest Limit */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-6 h-6 text-navy-600" />
              <h2 className="text-xl font-bold text-navy-900">Accompanying Guest Limit</h2>
            </div>
            <p className="text-sm text-navy-600 mb-4">Maximum number of guests that can accompany a resident (guests entering with the resident)</p>
            
            <input
              type="number"
              min="1"
              max="10"
              value={maxGuestsPerResident}
              onChange={(e) => setMaxGuestsPerResident(parseInt(e.target.value) || 3)}
              required
              className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 bg-white"
              placeholder="3"
            />
            <p className="text-xs text-navy-500 mt-2">Prevents residents from creating too many guest passes</p>
          </div>

          {/* Maintenance Mode */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
            <div className="flex items-center gap-3 mb-4">
              <Wrench className="w-6 h-6 text-navy-600" />
              <h2 className="text-xl font-bold text-navy-900">Maintenance Mode</h2>
            </div>
            <p className="text-sm text-navy-600 mb-4">Close the pool temporarily for maintenance or repairs</p>
            
            {/* Toggle Switch */}
            <div className="flex items-center gap-4 mb-4">
              <button
                type="button"
                onClick={() => setIsMaintenanceMode(!isMaintenanceMode)}
                className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                  isMaintenanceMode 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                role="switch"
                aria-checked={isMaintenanceMode}
              >
                <span
                  className={`inline-block h-8 w-8 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                    isMaintenanceMode ? 'translate-x-11' : 'translate-x-1'
                  }`}
                />
              </button>
              
              <span className={`font-semibold ${isMaintenanceMode ? 'text-red-600' : 'text-gray-600'}`}>
                {isMaintenanceMode ? 'ON - Pool Closed' : 'OFF - Pool Open'}
              </span>
            </div>

            {/* Maintenance Reason (only shown when maintenance mode is ON) */}
            {isMaintenanceMode && (
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">
                  Reason (displayed to residents)
                </label>
                <textarea
                  value={maintenanceReason}
                  onChange={(e) => setMaintenanceReason(e.target.value)}
                  placeholder="e.g., Scheduled maintenance, Pool cleaning, Repairs in progress"
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 bg-white resize-none"
                />
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-4 rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-6 h-6" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Shield, Loader2, MapPin, Users, Clock, CheckCircle, XCircle, LogIn, LogOut } from 'lucide-react'

interface ResidentProfile {
  id: string
  name: string
  email: string
  unit: string
  qr_code: string
  current_location: 'INSIDE' | 'OUTSIDE'
  property_name: string
  personal_guest_limit?: number | null
}

interface VisitorPass {
  id: string
  property_id: string
  qr_code: string
  status: string
  valid_date: string
  guest_count: number
  is_inside?: boolean
}

interface PropertySettings {
  max_guests_per_resident: number
}

export default function CheckInPage() {
  const params = useParams()
  const router = useRouter()
  const property_id = params.property_id as string

  // State
  const [loading, setLoading] = useState(true)
  const [resident, setResident] = useState<ResidentProfile | null>(null)
  const [visitorPass, setVisitorPass] = useState<VisitorPass | null>(null)
  const [showIdentityFork, setShowIdentityFork] = useState(false)
  const [showVisitorInput, setShowVisitorInput] = useState(false)
  const [visitorQRCode, setVisitorQRCode] = useState('')
  const [verifyingVisitor, setVerifyingVisitor] = useState(false)
  const [error, setError] = useState('')
  
  // Check-in state
  const [guestCount, setGuestCount] = useState(0)
  const [maxGuests, setMaxGuests] = useState(3)
  const [checkingIn, setCheckingIn] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showLivePass, setShowLivePass] = useState(false)

  // V10.1 Fix #3: Check for ?code= URL parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const codeParam = urlParams.get('code')
      
      if (codeParam) {
        console.log('[V10.1] Magic link detected with code:', codeParam)
        setVisitorQRCode(codeParam)
        setShowIdentityFork(false)
        setShowVisitorInput(true)
        // Auto-verify after a brief delay to ensure UI is ready
        setTimeout(() => {
          verifyVisitorPassWithCode(codeParam)
        }, 500)
      }
    }
  }, [])

  // V10.1 Fix #2: Fetch property settings for dual-layer guest limits
  useEffect(() => {
    const fetchPropertySettings = async () => {
      try {
        const response = await fetch(`/api/settings?property_id=${property_id}`)
        if (response.ok) {
          const data: PropertySettings = await response.json()
          console.log('[V10.1] Property settings loaded:', data)
          
          // Check resident session
          const storedResident = localStorage.getItem('resident_profile')
          if (storedResident) {
            const profile: ResidentProfile = JSON.parse(storedResident)
            setResident(profile)
            
            // V10.1 Fix #2: Dual-layer guest limit logic
            // Priority: personal_guest_limit → max_guests_per_resident
            const guestLimit = profile.personal_guest_limit ?? data.max_guests_per_resident ?? 3
            console.log('[V10.1] Guest limit:', {
              personal: profile.personal_guest_limit,
              property: data.max_guests_per_resident,
              final: guestLimit
            })
            setMaxGuests(guestLimit)
            setLoading(false)
          } else {
            // No session - show identity fork
            setMaxGuests(data.max_guests_per_resident ?? 3)
            setShowIdentityFork(true)
            setLoading(false)
          }
        } else {
          throw new Error('Failed to fetch property settings')
        }
      } catch (error) {
        console.error('[V10.1] Error loading property settings:', error)
        // Fallback: check session without property settings
        const storedResident = localStorage.getItem('resident_profile')
        if (storedResident) {
          const profile: ResidentProfile = JSON.parse(storedResident)
          setResident(profile)
          setMaxGuests(profile.personal_guest_limit ?? 3)
        } else {
          setShowIdentityFork(true)
        }
        setLoading(false)
      }
    }

    fetchPropertySettings()
  }, [property_id])

  // Live clock update
  useEffect(() => {
    if (showLivePass) {
      const interval = setInterval(() => {
        setCurrentTime(new Date())
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [showLivePass])

  // V10.0: Geofence check (150-foot radius)
  // Currently returns true by default for testing
  const checkLocation = async (): Promise<boolean> => {
    return true
    
    /* V10.0: Uncomment for production geofencing
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('Geolocation not supported')
        resolve(true) // Allow if geolocation unavailable
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          // TODO: Fetch property coordinates from API
          const propertyLat = 0 // Replace with actual coordinates
          const propertyLon = 0
          
          const userLat = position.coords.latitude
          const userLon = position.coords.longitude
          
          // Calculate distance using Haversine formula
          const R = 6371e3 // Earth radius in meters
          const φ1 = propertyLat * Math.PI / 180
          const φ2 = userLat * Math.PI / 180
          const Δφ = (userLat - propertyLat) * Math.PI / 180
          const Δλ = (userLon - propertyLon) * Math.PI / 180

          const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                    Math.cos(φ1) * Math.cos(φ2) *
                    Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
          const distance = R * c // Distance in meters

          const inRange = distance <= 45.72 // 150 feet = 45.72 meters
          resolve(inRange)
        },
        (error) => {
          console.error('Geolocation error:', error)
          resolve(true) // Allow if error
        }
      )
    })
    */
  }

  // V10.1 Fix #3: Verify visitor pass with code parameter (for magic link)
  const verifyVisitorPassWithCode = async (code: string) => {
    setVerifyingVisitor(true)
    setError('')

    try {
      const response = await fetch('/api/visitor-check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code: code })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Invalid visitor pass')
        setVerifyingVisitor(false)
        return
      }

      // Valid visitor pass - V10.1 Fix #4: Store is_inside state
      console.log('[V10.1] Visitor pass verified:', data.pass)
      setVisitorPass(data.pass)
      setShowVisitorInput(false)
      setShowIdentityFork(false)
      setMaxGuests(data.pass.guest_count || 0)
      setGuestCount(data.pass.guest_count || 0)
      setVerifyingVisitor(false)
    } catch (error) {
      console.error('Error verifying visitor pass:', error)
      setError('Failed to verify visitor pass')
      setVerifyingVisitor(false)
    }
  }

  // Verify visitor pass
  const verifyVisitorPass = async () => {
    if (!visitorQRCode.trim()) {
      setError('Please enter a visitor pass code')
      return
    }

    await verifyVisitorPassWithCode(visitorQRCode)
  }

  // Perform check-in or check-out
  const performCheckInOut = async (action: 'ENTRY' | 'EXIT') => {
    // Check geofence
    const inRange = await checkLocation()
    if (!inRange) {
      setError('You must be within 150 feet of the property to check in/out')
      return
    }

    setCheckingIn(true)
    setError('')

    try {
      // Determine location values
      const location_before = action === 'ENTRY' ? 'OUTSIDE' : 'INSIDE'
      const location_after = action === 'ENTRY' ? 'INSIDE' : 'OUTSIDE'
      const event_type = guestCount > 0 ? 'GROUP_ENTRY' : 'SCAN'

      // Log to access_logs
      const response = await fetch('/api/check-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_code: resident?.qr_code || visitorPass?.qr_code,
          scan_type: action,
          location_before,
          location_after,
          result: 'GRANTED',
          event_type,
          guest_count: guestCount,
          property_id,
          scanner_property_id: property_id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Check-in failed')
        setCheckingIn(false)
        return
      }

      // V10.1 Fix #4: Update visitor pass is_inside state
      if (visitorPass) {
        const isInside = action === 'ENTRY'
        console.log('[V10.1] Updating visitor is_inside:', isInside)
        
        // Update visitor_passes table via API
        try {
          const updateResponse = await fetch('/api/visitor-passes/update-location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              qr_code: visitorPass.qr_code,
              is_inside: isInside
            })
          })
          
          if (updateResponse.ok) {
            // Update local state
            setVisitorPass({ ...visitorPass, is_inside: isInside })
          }
        } catch (error) {
          console.error('[V10.1] Error updating visitor location:', error)
        }
      }

      // Show live pass
      setShowLivePass(true)
      setCheckingIn(false)

      // Update resident location in localStorage
      if (resident) {
        const updatedResident = { ...resident, current_location: location_after as 'INSIDE' | 'OUTSIDE' }
        localStorage.setItem('resident_profile', JSON.stringify(updatedResident))
        setResident(updatedResident)
      }

      // Auto-hide live pass after 10 seconds
      setTimeout(() => {
        setShowLivePass(false)
      }, 10000)

    } catch (error) {
      console.error('Error during check-in/out:', error)
      setError('Failed to complete check-in/out')
      setCheckingIn(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 to-navy-800 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-teal-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading check-in system...</p>
        </div>
      </div>
    )
  }

  // Identity Fork UI
  if (showIdentityFork) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 to-navy-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-8">
            <div className="bg-teal-500/20 p-4 rounded-full inline-block mb-4">
              <Shield className="w-12 h-12 text-teal-500" />
            </div>
            <h1 className="text-3xl font-bold text-navy-900 mb-2">Welcome</h1>
            <p className="text-navy-600">Please identify yourself to check in</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => router.push('/resident')}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white px-6 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 shadow-lg"
            >
              <Shield className="w-6 h-6" />
              I am a Resident
            </button>

            <button
              onClick={() => {
                setShowIdentityFork(false)
                setShowVisitorInput(true)
              }}
              className="w-full bg-navy-600 hover:bg-navy-700 text-white px-6 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 shadow-lg"
            >
              <Users className="w-6 h-6" />
              I have a Visitor Pass
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Visitor Input UI
  if (showVisitorInput) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 to-navy-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-8">
            <div className="bg-navy-500/20 p-4 rounded-full inline-block mb-4">
              <Users className="w-12 h-12 text-navy-600" />
            </div>
            <h1 className="text-3xl font-bold text-navy-900 mb-2">Visitor Check-In</h1>
            <p className="text-navy-600">Enter your visitor pass code</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                Visitor Pass Code
              </label>
              <input
                type="text"
                value={visitorQRCode}
                onChange={(e) => setVisitorQRCode(e.target.value)}
                placeholder="Enter code (e.g., GUEST-XXX)"
                className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                disabled={verifyingVisitor}
              />
            </div>

            <button
              onClick={verifyVisitorPass}
              disabled={verifyingVisitor}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white px-6 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifyingVisitor ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Verify Pass
                </>
              )}
            </button>

            <button
              onClick={() => {
                setShowVisitorInput(false)
                setShowIdentityFork(true)
                setError('')
              }}
              className="w-full bg-gray-200 hover:bg-gray-300 text-navy-900 px-6 py-3 rounded-xl font-semibold transition-all"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  // V10.0: Live Pass (Anti-Screenshot)
  if (showLivePass) {
    const totalPeople = 1 + guestCount
    const name = resident?.name || 'Visitor'

    return (
      <div className="min-h-screen bg-teal-500 animate-pulse flex items-center justify-center p-4">
        <div className="text-center text-white">
          {/* Moving Shield Icon */}
          <div className="mb-8 animate-bounce">
            <Shield className="w-32 h-32 mx-auto drop-shadow-2xl" />
          </div>

          {/* Name */}
          <h1 className="text-5xl font-bold mb-4 drop-shadow-lg">
            {name}
          </h1>

          {/* Group Count */}
          <p className="text-3xl font-semibold mb-8">
            Group of {totalPeople}
          </p>

          {/* Digital Clock */}
          <div className="text-6xl font-mono font-bold mb-8 drop-shadow-lg">
            {currentTime.toLocaleTimeString()}
          </div>

          {/* Status */}
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 inline-block">
            <p className="text-2xl font-bold">✓ ACCESS GRANTED</p>
            <p className="text-lg mt-2">Scan recorded successfully</p>
          </div>
        </div>
      </div>
    )
  }

  // V10.1 Fix #4: Check-In UI - Handle both resident and visitor is_inside state
  const isInside = resident 
    ? resident.current_location === 'INSIDE'
    : visitorPass?.is_inside === true

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-teal-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl">
        <div className="text-center mb-8">
          <div className="bg-teal-500/20 p-4 rounded-full inline-block mb-4">
            <Shield className="w-12 h-12 text-teal-600" />
          </div>
          <h1 className="text-3xl font-bold text-navy-900 mb-2">
            {resident ? `Welcome, ${resident.name}` : 'Visitor Check-In'}
          </h1>
          {resident && (
            <p className="text-navy-600">Unit: {resident.unit}</p>
          )}
          <p className="text-sm text-navy-500 mt-2">
            Current Status: <span className={`font-semibold ${isInside ? 'text-green-600' : 'text-orange-600'}`}>
              {isInside ? 'Inside' : 'Outside'}
            </span>
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Guest Count Selector */}
        {resident && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-navy-900 mb-3">
              Number of Guests
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setGuestCount(Math.max(0, guestCount - 1))}
                className="bg-navy-200 hover:bg-navy-300 text-navy-900 w-12 h-12 rounded-lg font-bold text-xl transition-all"
                disabled={guestCount === 0}
              >
                −
              </button>
              <div className="flex-1 text-center">
                <div className="text-4xl font-bold text-navy-900">{guestCount}</div>
                <p className="text-sm text-navy-600 mt-1">of {maxGuests} allowed</p>
              </div>
              <button
                onClick={() => setGuestCount(Math.min(maxGuests, guestCount + 1))}
                className="bg-teal-600 hover:bg-teal-700 text-white w-12 h-12 rounded-lg font-bold text-xl transition-all"
                disabled={guestCount >= maxGuests}
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => performCheckInOut('ENTRY')}
            disabled={checkingIn || isInside}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-xl font-semibold transition-all flex flex-col items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checkingIn ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <>
                <LogIn className="w-8 h-8" />
                <span>Check In</span>
              </>
            )}
          </button>

          <button
            onClick={() => performCheckInOut('EXIT')}
            disabled={checkingIn || !isInside}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-4 rounded-xl font-semibold transition-all flex flex-col items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checkingIn ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <>
                <LogOut className="w-8 h-8" />
                <span>Check Out</span>
              </>
            )}
          </button>
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-navy-50 rounded-lg">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-navy-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-navy-700">
              <p className="font-semibold mb-1">Location Verification</p>
              <p>You must be within 150 feet of the property to check in/out.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

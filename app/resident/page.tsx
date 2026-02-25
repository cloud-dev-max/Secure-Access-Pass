'use client'

import { useEffect, useState } from 'react'
import { 
  User,
  QrCode,
  Download,
  LogOut,

  Shield,
  Clock,
  Users,
  DollarSign,
  Share2,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import type { FacilityStatus, GuestPass } from '@/lib/types/database'

interface ResidentProfile {
  id: string
  name: string
  email: string
  unit: string
  phone: string | null
  qr_code: string
  current_location: 'INSIDE' | 'OUTSIDE'
  property_name: string // V9.14 Fix #3: Actual facility name (required)
}

export default function ResidentPortalPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [resident, setResident] = useState<ResidentProfile | null>(null)
  const [facilityStatus, setFacilityStatus] = useState<FacilityStatus | null>(null)
  const [guestPasses, setGuestPasses] = useState<GuestPass[]>([])
  const [maxGuestsAllowed, setMaxGuestsAllowed] = useState(3) // V4: Guest limit from settings
  
  // Login form - V4: Added PIN
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  // V4: Change PIN form
  const [showChangePinForm, setShowChangePinForm] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [changingPin, setChangingPin] = useState(false)

  // Guest pass form
  const [showGuestPassForm, setShowGuestPassForm] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [creatingPass, setCreatingPass] = useState(false)
  const [guestPassError, setGuestPassError] = useState('') // V7.3: Error handling
  const [showPassHistory, setShowPassHistory] = useState(false) // V7.1: Show expired/used passes
  const [latestGuestPassPrice, setLatestGuestPassPrice] = useState(5.00) // V5: Track latest price

  useEffect(() => {
    // Check if resident is already logged in (stored in localStorage)
    const storedResident = localStorage.getItem('resident_profile')
    if (storedResident) {
      try {
        const profile = JSON.parse(storedResident)
        setResident(profile)
        setIsLoggedIn(true)
        loadFacilityStatus()
        loadGuestPasses(profile.id)
      } catch (error) {
        console.error('Invalid stored profile:', error)
        localStorage.removeItem('resident_profile')
      }
    }
  }, [])

  // V7.6 Fix #3: Poll for facility status updates every 10 seconds
  useEffect(() => {
    if (!isLoggedIn) return

    const interval = setInterval(() => {
      loadFacilityStatus()
    }, 10000) // Poll every 10 seconds

    return () => clearInterval(interval)
  }, [isLoggedIn])

  const loadFacilityStatus = async () => {
    try {
      const response = await fetch('/api/facility-status')
      if (response.ok) {
        const data = await response.json()
        setFacilityStatus(data)
      }

      // V4: Also load max guests setting
      const settingsResponse = await fetch('/api/settings')
      if (settingsResponse.ok) {
        const settings = await settingsResponse.json()
        setMaxGuestsAllowed(settings.max_guests_per_resident || 3)
      }
    } catch (error) {
      console.error('Error loading facility status:', error)
    }
  }

  // V5: Helper to convert 24hr to 12hr format
  const formatTime12Hour = (time24: string) => {
    const [hours, minutes] = time24.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours % 12 || 12
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  const loadGuestPasses = async (residentId: string) => {
    try {
      const response = await fetch(`/api/guest-passes?resident_id=${residentId}`)
      if (response.ok) {
        const data = await response.json()
        setGuestPasses(data)
      }
    } catch (error) {
      console.error('Error loading guest passes:', error)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')

    // V4: Validate PIN format
    if (!/^\d{4}$/.test(pin)) {
      setLoginError('PIN must be exactly 4 digits')
      setLoginLoading(false)
      return
    }

    try {
      const response = await fetch('/api/resident-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(),
          pin: pin.trim()
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setLoginError(errorData.message || 'Invalid email or PIN')
        setLoginLoading(false)
        return
      }

      const profile = await response.json()
      
      // Store in localStorage (simulated auth)
      localStorage.setItem('resident_profile', JSON.stringify(profile))
      
      setResident(profile)
      setIsLoggedIn(true)
      setPin('') // Clear PIN from memory
      loadFacilityStatus()
      loadGuestPasses(profile.id)
    } catch (error) {
      console.error('Login error:', error)
      setLoginError('Network error. Please try again.')
    } finally {
      setLoginLoading(false)
    }
  }

  // V4: Handle PIN change
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!/^\d{4}$/.test(newPin)) {
      alert('New PIN must be exactly 4 digits')
      return
    }

    if (newPin !== confirmPin) {
      alert('New PIN and confirmation do not match')
      return
    }

    setChangingPin(true)

    try {
      const response = await fetch('/api/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resident_id: resident?.id,
          current_pin: currentPin,
          new_pin: newPin,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to change PIN')
        setChangingPin(false)
        return
      }

      alert('PIN changed successfully!')
      setShowChangePinForm(false)
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
    } catch (error) {
      console.error('Error changing PIN:', error)
      alert('Network error. Please try again.')
    } finally {
      setChangingPin(false)
    }
  }

  const handleLogout = () => {
    // V7.5 Issue #2: Deep clean - Clear ALL storage AND reset ALL form states
    localStorage.clear() // Clear ALL localStorage
    sessionStorage.clear() // Clear ALL sessionStorage
    
    // Reset ALL resident state
    setResident(null)
    setIsLoggedIn(false)
    
    // Reset ALL form states
    setEmail('')
    setPin('')
    setCurrentPin('')
    setNewPin('')
    setConfirmPin('')
    
    // Reset ALL guest pass form states
    setGuestName('')
    setGuestEmail('')
    setGuestPhone('')
    setGuestPassError('')
    setShowGuestPassForm(false)
    setShowChangePinForm(false)
    
    // Clear guest passes
    setGuestPasses([])
  }

  const downloadQR = () => {
    if (!resident) return

    // Create a new canvas for the professional digital ID
    const idCanvas = document.createElement('canvas')
    const ctx = idCanvas.getContext('2d')
    if (!ctx) return

    // Set card dimensions (standard ID card ratio)
    const cardWidth = 800
    const cardHeight = 500
    idCanvas.width = cardWidth
    idCanvas.height = cardHeight

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, cardWidth, cardHeight)
    gradient.addColorStop(0, '#0f172a') // navy-900
    gradient.addColorStop(0.5, '#1e293b') // navy-800
    gradient.addColorStop(1, '#0d9488') // teal-600
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, cardWidth, cardHeight)

    // Top accent bar
    ctx.fillStyle = '#14b8a6' // teal-500
    ctx.fillRect(0, 0, cardWidth, 60)

    // V9.10 Fix #3: Property name (top bar) - Use dynamic property name
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 32px Arial, sans-serif'
    ctx.textAlign = 'center'
    // V9.13 Fix #3: Use actual property name only, no fallback
    ctx.fillText(resident.property_name || '', cardWidth / 2, 42)

    // Card title
    ctx.font = 'bold 28px Arial, sans-serif'
    ctx.fillStyle = '#14b8a6' // teal-500
    ctx.textAlign = 'left'
    ctx.fillText('Pool Access Pass', 40, 120)

    // Resident name
    ctx.font = 'bold 42px Arial, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(resident.name, 40, 180)

    // Unit number
    ctx.font = '28px Arial, sans-serif'
    ctx.fillStyle = '#cbd5e1' // gray-300
    ctx.fillText(`Unit ${resident.unit}`, 40, 220)

    // Email
    ctx.font = '20px Arial, sans-serif'
    ctx.fillStyle = '#94a3b8' // gray-400
    ctx.fillText(resident.email, 40, 260)

    // V9.11 Fix #4: Status badge with proper padding
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 20px Arial, sans-serif'
    ctx.textAlign = 'center'
    const badgeText = '✓ VALID RESIDENT'
    const textWidth = ctx.measureText(badgeText).width
    const badgeX = 40
    const badgeY = 290
    const badgePadding = 20 // 10px each side
    ctx.fillStyle = '#10b981' // green-500
    ctx.fillRect(badgeX, badgeY, textWidth + badgePadding, 40)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(badgeText, badgeX + (textWidth + badgePadding) / 2, 316)

    // V4: Guests Allowed info
    ctx.font = '22px Arial, sans-serif'
    ctx.fillStyle = '#0d9488' // teal-600
    ctx.textAlign = 'left'
    ctx.fillText(`Guests Allowed: ${maxGuestsAllowed}`, 40, 360)

    // Add QR Code
    const qrCanvas = document.getElementById('resident-qr-canvas') as HTMLCanvasElement
    if (qrCanvas) {
      // Draw QR code on right side with white background
      const qrSize = 250
      const qrX = cardWidth - qrSize - 60
      const qrY = 110
      
      // White background for QR
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30)
      
      // Draw QR code
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)
    }

    // Footer text
    ctx.fillStyle = '#64748b' // gray-500
    ctx.font = '16px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Scan this QR code at the pool entrance', cardWidth / 2, cardHeight - 40)
    ctx.fillText('Valid for current resident only • Non-transferable', cardWidth / 2, cardHeight - 15)

    // Download the professional card
    const url = idCanvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `${resident.name.replace(/\s+/g, '-')}-Pool-Access-Card.png`
    link.href = url
    link.click()
  }

  // V7.3 Bug Fix #5: Better error handling for guest pass creation
  const createGuestPass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resident) return

    setGuestPassError('') // Clear previous errors

    // V7.9 Fix #3: Check guest pass limit - count 'active' OR 'used' if not expired
    const activeGuestPasses = guestPasses.filter(p => {
      const notExpired = new Date(p.expires_at) > new Date()
      const isValidStatus = p.status === 'active' || p.status === 'used'
      return notExpired && isValidStatus
    })
    if (activeGuestPasses.length >= maxGuestsAllowed) {
      setGuestPassError(`You have reached the maximum of ${maxGuestsAllowed} active guest passes. Please wait for existing passes to expire or be used.`)
      return
    }

    setCreatingPass(true)

    try {
      const response = await fetch('/api/guest-passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchased_by: resident.id,
          guest_name: guestName || null,
          guest_email: guestEmail || null,
          guest_phone: guestPhone || null,
        }),
      })

      if (!response.ok) {
        // V7.4 Issue #8: Better error parsing with specific server messages
        try {
          const errorData = await response.json()
          const errorMessage = errorData.error || errorData.details || errorData.message || 'Failed to create guest pass'
          setGuestPassError(errorMessage)
        } catch {
          setGuestPassError(`Failed to create guest pass (HTTP ${response.status})`)
        }
        return
      }

      // Success - Reset form
      setGuestName('')
      setGuestEmail('')
      setGuestPhone('')
      setGuestPassError('')
      setShowGuestPassForm(false)

      // Reload guest passes
      await loadGuestPasses(resident.id)
    } catch (error) {
      console.error('Error creating guest pass:', error)
      setGuestPassError('Network error. Please check your connection and try again.')
    } finally {
      setCreatingPass(false)
    }
  }

  const shareGuestPass = async (passId: string) => {
    const shareUrl = `${window.location.origin}/guest-pass/${passId}`

    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Pool Guest Pass',
          text: 'Here is your guest pass for pool access!',
          url: shareUrl,
        })
        return
      } catch (error) {
        // User cancelled or share failed
        console.log('Share cancelled or failed:', error)
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl)
      alert('Guest pass link copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy:', error)
      alert(`Share this link with your guest:\n\n${shareUrl}`)
    }
  }

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-teal-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="bg-teal-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-navy-900 mb-2">Resident Portal</h1>
            <p className="text-navy-600">Enter your email and 4-digit PIN</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-navy-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
                className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy-700 mb-2">
                4-Digit PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="****"
                required
                maxLength={4}
                pattern="\d{4}"
                className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500 text-center text-2xl font-mono tracking-widest"
              />
              <p className="text-xs text-navy-500 mt-1">Your manager provided this PIN when you registered</p>
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              {loginLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <User className="w-5 h-5" />
                  Access Portal
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Resident Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-50 via-teal-50 to-navy-100 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 text-white shadow-xl">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-teal-500 p-2 rounded-lg">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{resident?.name}</h1>
                <p className="text-sm text-navy-200">Unit {resident?.unit}</p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Facility Status */}
        <div className={`rounded-xl shadow-lg p-6 text-white ${
          facilityStatus?.is_open 
            ? 'bg-gradient-to-r from-green-500 to-green-600' 
            : 'bg-gradient-to-r from-red-500 to-red-600'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">
                {facilityStatus?.is_open ? 'POOL OPEN' : 'POOL CLOSED'}
              </h2>
              {facilityStatus?.is_maintenance_mode && (
                <p className="text-white/90 mt-1">{facilityStatus.maintenance_reason}</p>
              )}
              {!facilityStatus?.is_maintenance_mode && !facilityStatus?.is_open && (
                <p className="text-white/90 mt-1">
                  Hours: {facilityStatus?.operating_hours.start} - {facilityStatus?.operating_hours.end}
                </p>
              )}
            </div>
            {/* V5: Removed Activity icon per requirements */}
          </div>
          
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span>
                <strong className="font-bold">{facilityStatus?.current_occupancy} People Currently in Pool</strong> / {facilityStatus?.max_capacity}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span>
                {facilityStatus && formatTime12Hour(facilityStatus.operating_hours.start)} - {facilityStatus && formatTime12Hour(facilityStatus.operating_hours.end)}
              </span>
            </div>
          </div>
        </div>

        {/* My Pass QR Code */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
          <h2 className="text-xl font-bold text-navy-900 mb-4 flex items-center gap-2">
            <QrCode className="w-6 h-6 text-teal-600" />
            My Pool Pass
          </h2>
          
          <div className="text-center">
            <div className="bg-white p-4 rounded-xl border-4 border-navy-800 inline-block mb-4">
              <QRCodeCanvas
                id="resident-qr-canvas"
                value={resident?.qr_code || ''}
                size={250}
                level="H"
              />
            </div>
            
            <button
              onClick={downloadQR}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2 mx-auto"
            >
              <Download className="w-5 h-5" />
              Save to Photos
            </button>
          </div>
        </div>

        {/* Guest Passes */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-navy-900 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-teal-600" />
              Guest Passes
            </h2>
            
            {!showGuestPassForm && (
              <button
                onClick={async () => {
                  // V5: Fetch latest price before opening form
                  try {
                    const response = await fetch('/api/settings')
                    if (response.ok) {
                      const settings = await response.json()
                      setLatestGuestPassPrice(settings.guest_pass_price || 5.00)
                    }
                  } catch (error) {
                    console.error('Error fetching latest price:', error)
                  }
                  setShowGuestPassForm(true)
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all"
              >
                <Plus className="w-5 h-5" />
                Buy Guest Pass
              </button>
            )}
          </div>

          {/* V7.9 Fix #3: Display guest pass limit - Count 'active' OR 'used' if not expired */}
          <p className="text-sm text-navy-600 mb-4">
            Active passes: {guestPasses.filter(p => {
              const notExpired = new Date(p.expires_at) > new Date()
              const isValidStatus = p.status === 'active' || p.status === 'used'
              return notExpired && isValidStatus
            }).length} / {maxGuestsAllowed} allowed
          </p>

          {/* V7.3 Bug Fix #4 & #5: Guest Pass Purchase Form */}
          {showGuestPassForm && (
            <form onSubmit={createGuestPass} className="bg-navy-50 p-4 rounded-lg mb-4">
              <h3 className="font-semibold text-navy-900 mb-3">
                Purchase Guest Pass (${latestGuestPassPrice.toFixed(2)})
              </h3>
              
              {/* V7.3: Error message display */}
              {guestPassError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 font-semibold">{guestPassError}</p>
                </div>
              )}
              
              <div className="space-y-3">
                {/* V7.4 Issue #7: Name required, Email/Phone optional */}
                <input
                  type="text"
                  placeholder="Guest Name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                />
                <input
                  type="email"
                  placeholder="Guest Email (optional)"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                />
                <input
                  type="tel"
                  placeholder="Guest Phone (optional)"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                />
                
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={creatingPass}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                  >
                    {creatingPass ? 'Creating...' : 'Create Pass'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGuestPassForm(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 px-4 py-2 rounded-lg font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* V7.1: Show/Hide Pass History Toggle */}
          <div className="mb-4">
            <button
              onClick={() => setShowPassHistory(!showPassHistory)}
              className="text-sm text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1"
            >
              {showPassHistory ? '▼ Hide' : '▶ Show'} Pass History
            </button>
          </div>

          {/* Guest Pass List */}
          <div className="space-y-3">
            {guestPasses.length === 0 ? (
              <p className="text-center text-navy-500 py-4">
                No guest passes yet. Purchase one to invite a guest!
              </p>
            ) : (
              guestPasses.filter((pass) => {
                // V8.8 Fix #1: Handle null expires_at (unactivated passes)
                if (showPassHistory) return true
                // A pass is Active if: expires_at is null OR expires_at > now
                const isExpired = pass.expires_at && (new Date(pass.expires_at) < new Date() || pass.status === 'expired')
                return !isExpired
              }).map((pass) => {
                // V8.7 Fix #5: Dynamic status based on status and is_inside
                const isExpired = pass.expires_at && (new Date(pass.expires_at) < new Date() || pass.status === 'expired')
                const isInside = pass.is_inside === true
                const isActive = pass.status === 'active' && !pass.used_at
                const isUsed = pass.status === 'used' && pass.used_at
                
                // Determine status text and color
                let statusText = ''
                let statusIcon = <CheckCircle2 className="w-4 h-4" />
                let bgColor = 'bg-green-50 border-green-300'
                let iconColor = 'text-green-600'
                
                if (isExpired) {
                  statusText = 'Expired'
                  statusIcon = <XCircle className="w-4 h-4 text-red-600" />
                  bgColor = 'bg-red-50 border-red-300'
                  iconColor = 'text-red-600'
                } else if (isActive) {
                  statusText = 'Ready to Use - Valid for 1 Day upon entry'
                  bgColor = 'bg-green-50 border-green-300'
                  iconColor = 'text-green-600'
                } else if (isInside) {
                  const expiresTime = pass.expires_at ? new Date(pass.expires_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '11:59 PM'
                  statusText = `Currently Inside - Expires at ${expiresTime}`
                  bgColor = 'bg-blue-50 border-blue-300'
                  iconColor = 'text-blue-600'
                } else if (isUsed && !isInside) {
                  statusText = 'Scanned Out - Valid for Re-entry Today'
                  bgColor = 'bg-teal-50 border-teal-300'
                  iconColor = 'text-teal-600'
                }
                
                return (
                  <div
                    key={pass.id}
                    className={`p-4 rounded-lg border-2 ${bgColor}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-navy-900">
                          {pass.guest_name || 'Guest Pass'}
                        </div>
                        <div className="text-sm text-navy-600">
                          <span className={`flex items-center gap-1 ${iconColor}`}>
                            {statusIcon}
                            {statusText}
                          </span>
                        </div>
                      </div>
                      
                      {!isExpired && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => window.open(`/guest-pass/${pass.id}`, '_blank')}
                            className="bg-navy-600 hover:bg-navy-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all"
                          >
                            <QrCode className="w-4 h-4" />
                            View Pass
                          </button>
                          <button
                            onClick={() => shareGuestPass(pass.id)}
                            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all"
                          >
                            <Share2 className="w-4 h-4" />
                            Share
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* V4: Change PIN Section - Moved to bottom per V5 requirements */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
          <h2 className="text-xl font-bold text-navy-900 mb-4 flex items-center gap-2">
            <Shield className="w-6 h-6 text-teal-600" />
            Security Settings
          </h2>
          
          {!showChangePinForm ? (
            <button
              onClick={() => setShowChangePinForm(true)}
              className="bg-navy-600 hover:bg-navy-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
            >
              Change PIN
            </button>
          ) : (
            <form onSubmit={handleChangePin} className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Your PIN is used to log in to the resident portal. Keep it secure and don't share it with anyone.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">
                  Current PIN
                </label>
                <input
                  type="password"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="****"
                  required
                  maxLength={4}
                  className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white text-gray-900 placeholder-gray-500 text-center text-2xl font-mono tracking-widest"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">
                  New PIN (4 digits)
                </label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="****"
                  required
                  maxLength={4}
                  className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white text-gray-900 placeholder-gray-500 text-center text-2xl font-mono tracking-widest"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="****"
                  required
                  maxLength={4}
                  className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white text-gray-900 placeholder-gray-500 text-center text-2xl font-mono tracking-widest"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={changingPin}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                >
                  {changingPin ? 'Changing...' : 'Update PIN'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePinForm(false)
                    setCurrentPin('')
                    setNewPin('')
                    setConfirmPin('')
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 px-4 py-2 rounded-lg font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

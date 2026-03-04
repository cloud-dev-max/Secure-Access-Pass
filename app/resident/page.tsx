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
  property_id: string // V10.8.17: Required for fetching property-specific settings
}

export default function ResidentPortalPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [resident, setResident] = useState<ResidentProfile | null>(null)
  const [facilityStatus, setFacilityStatus] = useState<FacilityStatus | null>(null)
  const [guestPasses, setGuestPasses] = useState<GuestPass[]>([])
  const [maxGuestsAllowed, setMaxGuestsAllowed] = useState(3) // V4: Guest limit from settings
  const [visitorPassLimit, setVisitorPassLimit] = useState(100) // V10.8.21: Visitor pass limit from settings
  
  // Login form - V10.8.5: Upgraded to 6-digit PIN with segmented inputs
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState<string[]>(['', '', '', '', '', '']) // 6-digit array
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  // V4: Change PIN form
  const [showChangePinForm, setShowChangePinForm] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [changingPin, setChangingPin] = useState(false)
  const [changePinError, setChangePinError] = useState('') // V10.8.22: Inline error instead of alert
  const [changePinSuccess, setChangePinSuccess] = useState('') // V10.8.22: Success message

  // Guest pass form
  const [showGuestPassForm, setShowGuestPassForm] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [creatingPass, setCreatingPass] = useState(false)
  const [guestPassError, setGuestPassError] = useState('') // V7.3: Error handling
  const [showPassHistory, setShowPassHistory] = useState(false) // V7.1: Show expired/used passes
  const [latestGuestPassPrice, setLatestGuestPassPrice] = useState(5.00) // V5: Track latest price
  const [stripeConnected, setStripeConnected] = useState(false) // V10.8.16: Track Stripe connection status
  
  // V10.6: Demo Mode Checkout
  const [showDemoCheckout, setShowDemoCheckout] = useState(false)
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpMonth, setCardExpMonth] = useState('')
  const [cardExpYear, setCardExpYear] = useState('')
  const [cardCvc, setCardCvc] = useState('')
  const [processingPayment, setProcessingPayment] = useState(false)

  useEffect(() => {
    // V10.8.22: Check if resident is already logged in and auto-patch missing property_id
    const storedResident = localStorage.getItem('resident_profile')
    if (storedResident) {
      try {
        const profile = JSON.parse(storedResident)
        
        // V10.8.22: Auto-patch missing property_id from cached profiles
        if (!profile.property_id) {
          console.warn('[V10.8.22] Cached profile missing property_id, fetching from API...')
          // Fetch complete profile from API to get property_id
          fetch('/api/resident-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: profile.email, pin: '000000' }) // Dummy PIN - won't validate but returns profile
          })
            .then(res => res.json())
            .then(data => {
              if (data.property_id) {
                const patchedProfile = { ...profile, property_id: data.property_id }
                localStorage.setItem('resident_profile', JSON.stringify(patchedProfile))
                setResident(patchedProfile)
                console.log('[V10.8.22] Property ID patched:', data.property_id)
              } else {
                // If still missing, use profile as-is but log warning
                console.error('[V10.8.22] Unable to patch property_id')
                setResident(profile)
              }
              setIsLoggedIn(true)
              loadFacilityStatus()
              loadGuestPasses(profile.id)
            })
            .catch(err => {
              console.error('[V10.8.22] Auto-patch failed:', err)
              // Proceed with cached profile anyway
              setResident(profile)
              setIsLoggedIn(true)
              loadFacilityStatus()
              loadGuestPasses(profile.id)
            })
        } else {
          // Profile already has property_id
          setResident(profile)
          setIsLoggedIn(true)
          loadFacilityStatus()
          loadGuestPasses(profile.id)
        }
      } catch (error) {
        console.error('Invalid stored profile:', error)
        localStorage.removeItem('resident_profile')
      }
    }
  }, [])

  // V10.8.18: Load property settings when resident data is available
  useEffect(() => {
    const loadPropertySettings = async () => {
      if (!resident?.property_id) return; // Early return if no property_id yet
      
      try {
        const settingsResponse = await fetch(`/api/settings?property_id=${resident.property_id}`)
        if (settingsResponse.ok) {
          const settings = await settingsResponse.json()
          setMaxGuestsAllowed(settings.max_guests_per_resident || 3)
          setLatestGuestPassPrice(settings.guest_pass_price || 5.00)
          setStripeConnected(settings.stripe_connected || false)
          setVisitorPassLimit(settings.max_visitor_passes || 100) // V10.8.21: Fetch visitor pass limit
          console.log('[V10.8.21] Property settings loaded:', {
            property_id: resident.property_id,
            max_guests: settings.max_guests_per_resident,
            price: settings.guest_pass_price,
            stripe: settings.stripe_connected,
            visitor_pass_limit: settings.max_visitor_passes
          })
        }
      } catch (error) {
        console.error('Error loading property settings:', error)
      }
    }
    
    loadPropertySettings()
  }, [resident?.property_id]) // Re-run when property_id becomes available

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

    // V10.8.5: Validate 6-digit PIN format
    const fullPin = pin.join('')
    if (!/^\d{6}$/.test(fullPin)) {
      setLoginError('PIN must be exactly 6 digits')
      setLoginLoading(false)
      return
    }

    try {
      const response = await fetch('/api/resident-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(),
          pin: fullPin
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
    
    // V10.8.22: Replace alerts with inline errors
    if (!/^\d{4}$/.test(newPin)) {
      setChangePinError('New PIN must be exactly 4 digits')
      return
    }

    if (newPin !== confirmPin) {
      setChangePinError('New PIN and confirmation do not match')
      return
    }
    
    setChangePinError('') // Clear any previous errors
    setChangePinSuccess('') // Clear success message

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
        setChangePinError(errorData.error || 'Failed to change PIN')
        setChangingPin(false)
        return
      }

      // V10.8.22: Show success message inline instead of alert
      setChangePinSuccess('PIN changed successfully!')
      setChangePinError('')
      setTimeout(() => {
        setShowChangePinForm(false)
        setCurrentPin('')
        setNewPin('')
        setConfirmPin('')
        setChangePinSuccess('')
      }, 2000) // Hide form after 2 seconds
    } catch (error) {
      console.error('[V10.8.22] Error changing PIN:', error)
      setChangePinError('Network error. Please try again.')
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

  // V10.6: Demo Mode Checkout Handler
  const processDemoCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resident) return

    setGuestPassError('')
    setProcessingPayment(true)

    try {
      // V10.8.20: Pass resident's property_id to checkout API (not legacy env var)
      const response = await fetch('/api/stripe/demo-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_number: cardNumber,
          card_exp_month: cardExpMonth,
          card_exp_year: cardExpYear,
          card_cvc: cardCvc,
          amount: latestGuestPassPrice,
          property_id: resident.property_id,
          guest_count: 1,
          resident_id: resident.id,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setGuestPassError(data.error || 'Payment failed')
        return
      }

      // Success - Reset form
      setCardNumber('')
      setCardExpMonth('')
      setCardExpYear('')
      setCardCvc('')
      setGuestPassError('')
      setShowDemoCheckout(false)
      setShowGuestPassForm(false)

      // V10.8.22: Log success instead of alert
      console.log('[V10.8.22] Demo Payment Successful:', {
        pass_id: data.pass.id,
        qr_code: data.pass.qr_code,
        note: 'Test transaction - no real charges'
      })

      // Reload guest passes to show new pass
      await loadGuestPasses(resident.id)
    } catch (error) {
      console.error('Error processing demo checkout:', error)
      setGuestPassError('Network error. Please check your connection and try again.')
    } finally {
      setProcessingPayment(false)
    }
  }

  const shareGuestPass = async (passId: string) => {
    // V10.1 Fix #3: Find the pass to get the QR code
    const pass = guestPasses.find(p => p.id === passId)
    const qrCode = pass?.qr_code
    
    // V10.1 Fix #3: Magic link with ?code= parameter
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'
    const magicLink = qrCode 
      ? `${window.location.origin}/check-in/${propertyId}?code=${qrCode}`
      : `${window.location.origin}/guest-pass/${passId}`
    
    console.log('[V10.1] Magic link generated:', magicLink)

    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Pool Visitor Pass',
          text: `Here is your visitor pass! Click this link to check in: ${magicLink}`,
          url: magicLink,
        })
        return
      } catch (error) {
        // User cancelled or share failed
        console.log('Share cancelled or failed:', error)
      }
    }

    // V10.8.22: Copy to clipboard without blocking alert
    try {
      await navigator.clipboard.writeText(magicLink)
      console.log('[V10.8.22] Magic link copied to clipboard:', magicLink)
      // Could show a toast notification here instead of alert
    } catch (error) {
      console.error('[V10.8.22] Failed to copy magic link:', error)
      console.log('[V10.8.22] Share this magic link with your guest:', magicLink)
      // Could show the link in a modal instead of alert
    }
  }

  // V10.8.5: Premium Login Screen with 6-box segmented PIN input
  if (!isLoggedIn) {
    // Handler for PIN input changes with auto-advance
    const handlePinChange = (index: number, value: string) => {
      // Only allow digits
      if (value && !/^\d$/.test(value)) return
      
      const newPin = [...pin]
      newPin[index] = value
      setPin(newPin)
      
      // Auto-advance to next box
      if (value && index < 5) {
        const nextInput = document.getElementById(`pin-${index + 1}`)
        nextInput?.focus()
      }
    }
    
    // Handler for backspace navigation
    const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !pin[index] && index > 0) {
        const prevInput = document.getElementById(`pin-${index - 1}`)
        prevInput?.focus()
      }
    }
    
    // Handler for paste
    const handlePinPaste = (e: React.ClipboardEvent) => {
      e.preventDefault()
      const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
      const newPin = [...pin]
      for (let i = 0; i < pastedData.length; i++) {
        newPin[i] = pastedData[i]
      }
      setPin(newPin)
      
      // Focus last filled box or first empty box
      const nextIndex = Math.min(pastedData.length, 5)
      const nextInput = document.getElementById(`pin-${nextIndex}`)
      nextInput?.focus()
    }
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-teal-900 flex items-center justify-center p-4">
        {/* V10.8.5: Premium glassmorphism card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 max-w-lg w-full border border-white/20">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Shield className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-navy-900 mb-3">Resident Portal</h1>
            <p className="text-navy-600 text-lg">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-bold text-navy-700 mb-3">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
                className="w-full px-5 py-4 border-2 border-navy-200 rounded-xl focus:ring-4 focus:ring-teal-500/20 focus:border-teal-500 bg-white text-gray-900 placeholder-gray-400 transition-all text-lg"
              />
            </div>

            {/* V10.8.5: Premium 6-Box Segmented PIN Input */}
            <div>
              <label className="block text-sm font-bold text-navy-700 mb-3">
                6-Digit PIN
              </label>
              <div className="flex gap-3 justify-center" onPaste={handlePinPaste}>
                {pin.map((digit, index) => (
                  <input
                    key={index}
                    id={`pin-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(index, e)}
                    className="w-14 h-16 text-center text-3xl font-bold border-3 border-navy-300 rounded-xl focus:ring-4 focus:ring-teal-500/30 focus:border-teal-500 bg-white text-navy-900 transition-all shadow-sm hover:border-navy-400"
                    required
                  />
                ))}
              </div>
              <p className="text-sm text-navy-500 mt-3 text-center">
                Your manager provided this PIN when you registered
              </p>
            </div>

            {/* Error Message */}
            {loginError && (
              <div className="bg-red-50 border-2 border-red-200 text-red-800 p-4 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                <span className="text-sm font-medium">{loginError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loginLoading || pin.some(d => !d)}
              className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-6 py-4 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3"
            >
              {loginLoading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <User className="w-6 h-6" />
                  <span>Access Portal</span>
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
          <div className="flex max-[850px]:flex-col max-[850px]:gap-4 min-[850px]:flex-row min-[850px]:items-center min-[850px]:justify-between">
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
              Visitor Passes
            </h2>
            
            {!showGuestPassForm && (
              <div>
                <button
                  onClick={async () => {
                    // V10.8.20: Graceful error handling - no blocking alerts
                    if (!resident?.property_id) {
                      console.error('[V10.8.20] Cannot load settings: resident.property_id is missing')
                      setGuestPassError('Unable to load property settings. Please try logging in again.')
                      return;
                    }
                    try {
                      const response = await fetch(`/api/settings?property_id=${resident.property_id}`)
                      if (response.ok) {
                        const settings = await response.json()
                        setLatestGuestPassPrice(settings.guest_pass_price || 5.00)
                        setStripeConnected(settings.stripe_connected || false)
                        setGuestPassError('') // Clear any previous errors
                        setShowGuestPassForm(true)
                      } else {
                        console.error('[V10.8.20] Settings API returned non-OK status:', response.status)
                        setGuestPassError('Unable to load pricing. Please try again.')
                      }
                    } catch (error) {
                      console.error('[V10.8.20] Error fetching latest price:', error)
                      setGuestPassError('Network error. Please check your connection.')
                    }
                  }}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Buy Visitor Pass
                </button>
                {/* V10.8.16: Show message if Stripe not connected */}
                {showGuestPassForm && !stripeConnected && (
                  <p className="text-sm text-orange-600 mt-2">
                    ⚠️ Purchases currently disabled by management
                  </p>
                )}
              </div>
            )}
          </div>

          {/* V10.8.21: Display visitor pass limit from database settings */}
          <p className="text-sm text-navy-600 mb-4">
            Active passes: {guestPasses.filter(p => {
              const notExpired = new Date(p.expires_at) > new Date()
              const isValidStatus = p.status === 'active' || p.status === 'used'
              return notExpired && isValidStatus
            }).length} / {visitorPassLimit} allowed
          </p>

          {/* V7.3 Bug Fix #4 & #5: Guest Pass Purchase Form */}
          {/* V10.8.16: Only show if Stripe is connected */}
          {showGuestPassForm && !showDemoCheckout && stripeConnected && (
            <div className="bg-navy-50 p-4 rounded-lg mb-4">
              <h3 className="font-semibold text-navy-900 mb-3">
                Purchase Visitor Pass (${latestGuestPassPrice.toFixed(2)})
              </h3>
              
              {/* V10.6: Demo Mode Indicator */}
              <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-300 rounded-lg">
                <p className="text-sm text-blue-800 font-semibold">🧪 Demo Mode Active</p>
                <p className="text-xs text-blue-700 mt-1">
                  Test the checkout flow with Stripe test cards. No real charges will be made.
                </p>
              </div>
              
              {/* V7.3: Error message display */}
              {guestPassError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 font-semibold">{guestPassError}</p>
                </div>
              )}
              
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowDemoCheckout(true)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                  <DollarSign className="w-5 h-5" />
                  Proceed to Demo Checkout
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowGuestPassForm(false)}
                  className="w-full bg-gray-300 hover:bg-gray-400 text-gray-900 px-4 py-2 rounded-lg font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* V10.6: Demo Mode Checkout Form */}
          {/* V10.8.16: Only show if Stripe is connected */}
          {showGuestPassForm && showDemoCheckout && stripeConnected && (
            <form onSubmit={processDemoCheckout} className="bg-navy-50 p-4 rounded-lg mb-4">
              <h3 className="font-semibold text-navy-900 mb-3">
                Demo Checkout - ${latestGuestPassPrice.toFixed(2)}
              </h3>
              
              {/* Demo Mode Banner */}
              <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                <p className="text-sm text-yellow-900 font-semibold">🔒 Test Mode - No Real Charges</p>
                <p className="text-xs text-yellow-800 mt-1">
                  Use test card: <code className="bg-yellow-100 px-1 rounded font-mono">4242 4242 4242 4242</code>
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Any future date, any CVC
                </p>
              </div>
              
              {/* Error message */}
              {guestPassError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 font-semibold">{guestPassError}</p>
                </div>
              )}
              
              <div className="space-y-3">
                {/* Card Number */}
                <div>
                  <label className="block text-sm font-semibold text-navy-900 mb-1">
                    Card Number
                  </label>
                  <input
                    type="text"
                    placeholder="4242 4242 4242 4242"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim())}
                    maxLength={19}
                    required
                    className="w-full px-4 py-2 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500 font-mono"
                  />
                </div>
                
                {/* Expiry and CVC */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-semibold text-navy-900 mb-1">
                      Month
                    </label>
                    <input
                      type="text"
                      placeholder="12"
                      value={cardExpMonth}
                      onChange={(e) => setCardExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      maxLength={2}
                      required
                      className="w-full px-4 py-2 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white text-gray-900 placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-navy-900 mb-1">
                      Year
                    </label>
                    <input
                      type="text"
                      placeholder="2026"
                      value={cardExpYear}
                      onChange={(e) => setCardExpYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      maxLength={4}
                      required
                      className="w-full px-4 py-2 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white text-gray-900 placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-navy-900 mb-1">
                      CVC
                    </label>
                    <input
                      type="text"
                      placeholder="123"
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      maxLength={4}
                      required
                      className="w-full px-4 py-2 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white text-gray-900 placeholder-gray-500"
                    />
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={processingPayment}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {processingPayment ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <DollarSign className="w-5 h-5" />
                        Pay ${latestGuestPassPrice.toFixed(2)}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDemoCheckout(false)
                      setCardNumber('')
                      setCardExpMonth('')
                      setCardExpYear('')
                      setCardCvc('')
                      setGuestPassError('')
                    }}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 px-4 py-2 rounded-lg font-semibold"
                  >
                    Back
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

          {/* Visitor Pass List */}
          <div className="space-y-3">
            {guestPasses.length === 0 ? (
              <p className="text-center text-navy-500 py-4">
                No visitor passes yet. Purchase one to invite a visitor!
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
                          {pass.guest_name || 'Visitor Pass'}
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

'use client'

import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, X, CheckCircle2, XCircle, Loader2, Home, Users } from 'lucide-react'

type ScanMode = 'ENTRY' | 'EXIT'
type ScanResult = 'idle' | 'scanning' | 'success' | 'denied' | 'error' | 'group_prompt'
type UserInfo = {
  name: string
  id: string
  current_location: 'INSIDE' | 'OUTSIDE'
  active_guests: number
  personal_guest_limit: number | null
  property_max_guests: number
}

export default function ScannerPage() {
  const [mode, setMode] = useState<ScanMode>('ENTRY')
  const [scanResult, setScanResult] = useState<ScanResult>('idle')
  const [message, setMessage] = useState<string>('')
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  
  // V6: Group entry/exit modal state
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [scannedQR, setScannedQR] = useState<string>('')
  const [processingGroup, setProcessingGroup] = useState(false)

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop()
      }
    }
  }, [])

  const startScanner = async () => {
    try {
      setCameraError(null)
      
      // Wait for DOM element
      const checkElement = () => {
        return new Promise<void>((resolve, reject) => {
          const maxAttempts = 20
          let attempts = 0
          
          const check = () => {
            const element = document.getElementById('qr-reader')
            if (element) {
              resolve()
            } else if (attempts >= maxAttempts) {
              reject(new Error('QR reader element not found'))
            } else {
              attempts++
              setTimeout(check, 100)
            }
          }
          check()
        })
      }

      setIsScanning(true)
      await checkElement()
      
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onScanSuccess,
        () => {}
      )
    } catch (error) {
      console.error('Error starting scanner:', error)
      setIsScanning(false)
      setCameraError('Unable to access camera. Please grant permissions.')
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop()
      setIsScanning(false)
    }
  }

  const onScanSuccess = async (decodedText: string) => {
    await stopScanner()
    setScannedQR(decodedText)
    setScanResult('scanning')
    setMessage('Checking access...')

    try {
      // V6: First check user info (don't process group logic in API yet)
      const response = await fetch('/api/check-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_code: decodedText,
          scan_type: mode,
          check_only: true // V6: Just check, don't log yet
        }),
      })

      const data = await response.json()

      if (data.can_access) {
        // V6: Check if this is a resident who needs group prompt
        if (data.user_type === 'resident') {
          const user: UserInfo = {
            name: data.user_name,
            id: data.user_id,
            current_location: data.current_location,
            active_guests: data.active_guests || 0,
            personal_guest_limit: data.personal_guest_limit,
            property_max_guests: data.property_max_guests || 3
          }
          setUserInfo(user)
          
          // Determine if we need group modal
          if (mode === 'ENTRY' && user.current_location === 'OUTSIDE') {
            // Entering: Show group prompt
            setScanResult('group_prompt')
            setShowGroupModal(true)
          } else if (mode === 'ENTRY' && user.current_location === 'INSIDE') {
            // Already inside: Show add guests modal
            setScanResult('group_prompt')
            setMessage('Already inside. Add more guests?')
            setShowGroupModal(true)
          } else if (mode === 'EXIT' && user.current_location === 'INSIDE') {
            // Exiting with group: Show exit modal
            setScanResult('group_prompt')
            setShowGroupModal(true)
          } else {
            // Simple case: Process immediately with count 0
            await processGroupAccess(0)
          }
        } else {
          // Visitor pass: Simple grant
          setScanResult('success')
          setUserInfo({ 
            name: data.user_name, 
            id: data.user_id,
            current_location: 'OUTSIDE',
            active_guests: 0,
            personal_guest_limit: null,
            property_max_guests: 0
          })
          setMessage('Access Granted')
          setTimeout(resetScanner, 3000)
        }
      } else {
        setScanResult('denied')
        setMessage(data.denial_reason || 'Access Denied')
        setUserInfo(null)
        setTimeout(resetScanner, 3000)
      }
    } catch (error) {
      console.error('Access check error:', error)
      setScanResult('error')
      setMessage('System Error')
      setTimeout(resetScanner, 3000)
    }
  }

  const processGroupAccess = async (guestCount: number) => {
    setProcessingGroup(true)
    
    try {
      const response = await fetch('/api/check-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_code: scannedQR,
          scan_type: mode,
          guest_count: guestCount
        }),
      })

      const data = await response.json()

      if (data.can_access) {
        setScanResult('success')
        if (guestCount > 0) {
          setMessage(`${data.user_name} + ${guestCount} Guest${guestCount > 1 ? 's' : ''}`)
        } else {
          setMessage(`${data.user_name}`)
        }
      } else {
        setScanResult('denied')
        setMessage(data.denial_reason || 'Access Denied')
      }
      
      setShowGroupModal(false)
      setTimeout(resetScanner, 3000)
    } catch (error) {
      console.error('Group access error:', error)
      setScanResult('error')
      setMessage('System Error')
      setShowGroupModal(false)
      setTimeout(resetScanner, 3000)
    } finally {
      setProcessingGroup(false)
    }
  }

  const resetScanner = () => {
    setScanResult('idle')
    setMessage('')
    setUserInfo(null)
    setShowGroupModal(false)
    setScannedQR('')
  }

  const renderGroupModal = () => {
    if (!userInfo || !showGroupModal) return null

    const effectiveLimit = userInfo.personal_guest_limit ?? userInfo.property_max_guests
    const currentGuests = userInfo.active_guests

    if (mode === 'ENTRY' && userInfo.current_location === 'OUTSIDE') {
      // Scenario 1: Entry with guests
      const maxGuests = effectiveLimit
      const buttons = Array.from({ length: maxGuests + 1 }, (_, i) => i)

      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-navy-900 mb-2">
              Entry: {userInfo.name}
            </h2>
            <p className="text-navy-600 mb-6">
              How many guests are with you?
            </p>
            
            <div className="grid grid-cols-3 gap-4">
              {buttons.map((count) => (
                <button
                  key={count}
                  onClick={() => processGroupAccess(count)}
                  disabled={processingGroup}
                  className="h-20 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-2xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                >
                  {count === 0 ? 'Just me' : `+${count}`}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setShowGroupModal(false)
                resetScanner()
              }}
              className="mt-6 w-full py-3 bg-gray-200 hover:bg-gray-300 text-navy-900 rounded-lg font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )
    } else if (mode === 'ENTRY' && userInfo.current_location === 'INSIDE') {
      // Scenario 2: Already inside, add guests
      const remainingSlots = effectiveLimit - currentGuests
      const buttons = Array.from({ length: remainingSlots + 1 }, (_, i) => i)

      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-navy-900 mb-2">
              {userInfo.name} is already inside
            </h2>
            <p className="text-navy-600 mb-2">
              Current guests: {currentGuests}
            </p>
            <p className="text-navy-600 mb-6">
              Add more guests?
            </p>
            
            <div className="grid grid-cols-3 gap-4">
              {buttons.map((count) => (
                <button
                  key={count}
                  onClick={() => processGroupAccess(count)}
                  disabled={processingGroup}
                  className="h-20 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-2xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                >
                  {count === 0 ? 'None' : `+${count}`}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setShowGroupModal(false)
                resetScanner()
              }}
              className="mt-6 w-full py-3 bg-gray-200 hover:bg-gray-300 text-navy-900 rounded-lg font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )
    } else if (mode === 'EXIT' && userInfo.current_location === 'INSIDE') {
      // Scenario 3: Exit with group
      const totalGroup = currentGuests + 1 // +1 for resident
      const buttons = Array.from({ length: totalGroup }, (_, i) => i + 1)

      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-navy-900 mb-2">
              Check Out
            </h2>
            <p className="text-navy-600 mb-2">
              Current group size: {totalGroup}
            </p>
            <p className="text-navy-600 mb-6">
              How many are leaving?
            </p>
            
            <div className="grid grid-cols-3 gap-4">
              {buttons.map((count, index) => {
                const isAll = count === totalGroup && totalGroup > 1
                return (
                  <button
                    key={count}
                    onClick={() => processGroupAccess(count - 1)} // -1 because API expects guest count
                    disabled={processingGroup}
                    className="h-20 rounded-xl bg-red-600 hover:bg-red-700 text-white text-lg font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center"
                  >
                    {isAll ? `ALL (${count})` : count}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => {
                setShowGroupModal(false)
                resetScanner()
              }}
              className="mt-6 w-full py-3 bg-gray-200 hover:bg-gray-300 text-navy-900 rounded-lg font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-teal-900 text-white">
      {/* Header */}
      <div className="bg-navy-800/50 backdrop-blur-sm border-b border-navy-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-teal-600 rounded-xl flex items-center justify-center">
              <Camera className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Secure Access Pass</h1>
              <p className="text-sm text-white/70">Pool Access Scanner</p>
            </div>
          </div>

          {/* V5: Home button instead of X */}
          <a
            href="/dashboard"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg font-semibold transition-all flex items-center gap-2"
          >
            <Home className="w-5 h-5" />
            Dashboard
          </a>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center justify-center gap-4 p-6">
        <button
          onClick={() => setMode('ENTRY')}
          className={`px-8 py-4 rounded-xl font-bold text-lg transition-all ${
            mode === 'ENTRY'
              ? 'bg-teal-600 text-white shadow-xl'
              : 'bg-navy-700 text-white/60 hover:bg-navy-600'
          }`}
        >
          ENTRY
        </button>
        <button
          onClick={() => setMode('EXIT')}
          className={`px-8 py-4 rounded-xl font-bold text-lg transition-all ${
            mode === 'EXIT'
              ? 'bg-navy-600 text-white shadow-xl'
              : 'bg-navy-700 text-white/60 hover:bg-navy-600'
          }`}
        >
          EXIT
        </button>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center px-4 pb-8">
        {!isScanning && scanResult === 'idle' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center max-w-md">
            <Camera className="w-20 h-20 mx-auto mb-4 text-teal-400" />
            <h2 className="text-2xl font-bold mb-2">Ready to Scan</h2>
            <p className="text-white/80 mb-6">
              Tap below to start scanning QR codes
            </p>
            <button
              onClick={startScanner}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg transition-all"
            >
              Start Scanner
            </button>
            {cameraError && (
              <p className="mt-4 text-red-400 text-sm">{cameraError}</p>
            )}
          </div>
        )}

        {isScanning && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 max-w-md w-full">
            <div className="relative">
              <div id="qr-reader" className="rounded-xl overflow-hidden"></div>
              <div className="absolute top-2 right-2">
                <button
                  onClick={stopScanner}
                  className="bg-red-600 hover:bg-red-700 p-2 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <p className="text-center mt-4 text-white/80">
              Position QR code in the frame
            </p>
          </div>
        )}

        {scanResult === 'scanning' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center max-w-md">
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-teal-400 animate-spin" />
            <h2 className="text-2xl font-bold">{message}</h2>
          </div>
        )}

        {scanResult === 'success' && (
          <div className="bg-green-600 rounded-2xl p-8 text-center max-w-md shadow-2xl">
            <CheckCircle2 className="w-20 h-20 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-2">Access Granted</h2>
            <p className="text-xl">{message || userInfo?.name}</p>
          </div>
        )}

        {scanResult === 'denied' && (
          <div className="bg-red-600 rounded-2xl p-8 text-center max-w-md shadow-2xl">
            <XCircle className="w-20 h-20 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-2">Access Denied</h2>
            <p className="text-lg">{message}</p>
          </div>
        )}

        {scanResult === 'error' && (
          <div className="bg-red-600 rounded-2xl p-8 text-center max-w-md shadow-2xl">
            <XCircle className="w-20 h-20 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-2">Error</h2>
            <p className="text-lg">{message}</p>
          </div>
        )}
      </div>

      {/* V6: Group Entry/Exit Modal */}
      {renderGroupModal()}
    </div>
  )
}

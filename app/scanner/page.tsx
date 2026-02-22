'use client'

import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, X, CheckCircle2, XCircle, Loader2, Home, Users, AlertTriangle, MessageSquare, LogOut, Shield } from 'lucide-react'

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
  
  // V7.4: Staff Mode features
  const [showOccupancyPanel, setShowOccupancyPanel] = useState(false)
  const [insideResidents, setInsideResidents] = useState<any[]>([])
  const [loadingOccupancy, setLoadingOccupancy] = useState(false)
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastTarget, setBroadcastTarget] = useState<'INSIDE' | 'RECENT' | 'ALL'>('INSIDE') // V7.5: Target options
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [isPoolOpen, setIsPoolOpen] = useState(true)
  const [closingPool, setClosingPool] = useState(false)
  const [closeReason, setCloseReason] = useState('') // V7.5: Reason for closing

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop()
      }
    }
  }, [])

  // V7.6 Fix #3: Realtime listener for pool status sync
  useEffect(() => {
    // Load initial pool status
    const loadPoolStatus = async () => {
      try {
        const response = await fetch('/api/settings')
        if (response.ok) {
          const data = await response.json()
          // V7.6: Correct interpretation - maintenance_mode TRUE = CLOSED
          setIsPoolOpen(!data.is_maintenance_mode)
          if (data.maintenance_reason) {
            setCloseReason(data.maintenance_reason)
          }
        }
      } catch (error) {
        console.error('Error loading pool status:', error)
      }
    }

    loadPoolStatus()

    // Poll for status updates every 10 seconds (simpler than Realtime for now)
    const interval = setInterval(loadPoolStatus, 10000)

    return () => clearInterval(interval)
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
        // V7.1: Use API-formatted message directly (already includes guest count)
        setMessage(data.user_name)
      } else {
        setScanResult('denied')
        // V7.1: Use specific denial reason from API
        setMessage(data.denial_reason || data.message || 'Access Denied')
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
  
  // V7.4: Staff Mode functions
  const loadOccupancy = async () => {
    setLoadingOccupancy(true)
    try {
      const response = await fetch('/api/residents')
      if (response.ok) {
        const data = await response.json()
        const inside = data.filter((r: any) => r.current_location === 'INSIDE')
        setInsideResidents(inside)
      }
    } catch (error) {
      console.error('Error loading occupancy:', error)
    } finally {
      setLoadingOccupancy(false)
    }
  }
  
  const forceExit = async (residentId: string) => {
    if (!confirm('Force exit this person?')) return
    
    try {
      const response = await fetch('/api/residents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: residentId,
          current_location: 'OUTSIDE',
          active_guests: 0,
        }),
      })
      
      if (response.ok) {
        await loadOccupancy()
      }
    } catch (error) {
      console.error('Error forcing exit:', error)
      alert('Failed to force exit')
    }
  }
  
  // V7.5 Issue #9: Expanded broadcast with target options
  const sendBroadcast = async () => {
    if (!broadcastMessage.trim()) return
    
    setSendingBroadcast(true)
    try {
      const response = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: broadcastMessage,
          target_filter: broadcastTarget, // V7.5: Use selected target
        }),
      })
      
      if (response.ok) {
        const data = await response.json()
        alert(`Alert sent to ${data.recipients_count} recipient(s)!`)
        setBroadcastMessage('')
        setBroadcastTarget('INSIDE')
        setShowBroadcastModal(false)
      } else {
        alert('Failed to send alert')
      }
    } catch (error) {
      console.error('Error sending broadcast:', error)
      alert('Network error')
    } finally {
      setSendingBroadcast(false)
    }
  }
  
  // V7.5 Issue #9: Prompt for reason when closing pool
  const togglePoolStatus = async () => {
    let reason = ''
    
    // V7.5: Prompt for reason when closing
    if (isPoolOpen) {
      reason = prompt('Please enter a reason for closing the pool:')
      if (reason === null) return // User cancelled
      if (!reason.trim()) {
        alert('Reason is required to close the pool')
        return
      }
    }
    
    if (!confirm(`Are you sure you want to ${isPoolOpen ? 'CLOSE' : 'OPEN'} the pool?`)) return
    
    setClosingPool(true)
    try {
      // V7.6 Fix #2: Correct logic - maintenance_mode TRUE = CLOSED, FALSE = OPEN
      // When isPoolOpen=true (currently open), we want to CLOSE it, so send TRUE
      // When isPoolOpen=false (currently closed), we want to OPEN it, so send FALSE
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_maintenance_mode: isPoolOpen, // When pool is open and we click, we want to close it (set TRUE)
          maintenance_reason: isPoolOpen ? reason : '',
        }),
      })
      
      if (response.ok) {
        setIsPoolOpen(!isPoolOpen)
        setCloseReason(isPoolOpen ? reason : '')
        alert(`Pool ${isPoolOpen ? 'CLOSED' : 'OPENED'} successfully!`)
      } else {
        alert('Failed to update pool status')
      }
    } catch (error) {
      console.error('Error toggling pool:', error)
      alert('Network error')
    } finally {
      setClosingPool(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-teal-900 text-white">
      {/* Header - V7.4: Staff Mode (Dashboard link removed per Issue #1) */}
      <div className="bg-navy-800/50 backdrop-blur-sm border-b border-navy-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-teal-600 rounded-xl flex items-center justify-center">
              <Camera className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Secure Access Scanner</h1>
              <p className="text-sm text-white/70">Staff Mode</p>
            </div>
          </div>

          {/* V7.4: Staff Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowOccupancyPanel(!showOccupancyPanel); if (!showOccupancyPanel) loadOccupancy(); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-all flex items-center gap-2"
            >
              <Users className="w-5 h-5" />
              Occupancy
            </button>
            <button
              onClick={() => setShowBroadcastModal(true)}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg font-semibold transition-all flex items-center gap-2"
            >
              <MessageSquare className="w-5 h-5" />
              Alert
            </button>
            <button
              onClick={togglePoolStatus}
              disabled={closingPool}
              className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                isPoolOpen 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              <Shield className="w-5 h-5" />
              {closingPool ? 'Updating...' : (isPoolOpen ? 'Close Pool' : 'Open Pool')}
            </button>
          </div>
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
      
      {/* V7.4: Occupancy Panel */}
      {showOccupancyPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-teal-600 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">People Currently Inside</h2>
              <button
                onClick={() => setShowOccupancyPanel(false)}
                className="text-white hover:bg-white/20 rounded-lg p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {loadingOccupancy ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                </div>
              ) : insideResidents.length === 0 ? (
                <p className="text-center text-gray-500 py-12">No one is currently inside</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-navy-800 text-white">
                      <tr>
                        <th className="px-4 py-3 text-left">Name</th>
                        <th className="px-4 py-3 text-left">Unit</th>
                        <th className="px-4 py-3 text-center">Guests</th>
                        <th className="px-4 py-3 text-center">Total People</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {insideResidents.map((resident: any) => {
                        const totalPeople = 1 + (resident.active_guests || 0)
                        return (
                          <tr key={resident.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-900 font-semibold">{resident.name}</td>
                            <td className="px-4 py-3 text-gray-700">{resident.unit}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                                +{resident.active_guests || 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-900 font-bold">{totalPeople}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => forceExit(resident.id)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold"
                              >
                                Force Exit
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={loadOccupancy}
                  disabled={loadingOccupancy}
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {loadingOccupancy ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* V7.4: Broadcast Alert Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Send Alert</h2>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="text-gray-500 hover:bg-gray-100 rounded-lg p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Send emergency or informational messages to residents
            </p>
            
            {/* V7.5 Issue #9: Target selection */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Send To:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setBroadcastTarget('INSIDE')}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    broadcastTarget === 'INSIDE'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Inside Now
                </button>
                <button
                  onClick={() => setBroadcastTarget('RECENT')}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    broadcastTarget === 'RECENT'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Last 4 Hours
                </button>
                <button
                  onClick={() => setBroadcastTarget('ALL')}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    broadcastTarget === 'ALL'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Today
                </button>
              </div>
            </div>
            
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="Enter your message..."
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 placeholder-gray-500"
            />
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={sendBroadcast}
                disabled={sendingBroadcast || !broadcastMessage.trim()}
                className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {sendingBroadcast ? 'Sending...' : 'Send Alert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

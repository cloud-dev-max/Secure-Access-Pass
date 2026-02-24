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
  user_type?: 'resident' | 'visitor_pass' // V7.8: Track user type
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
  
  // V7.8: Real-time occupancy counter
  const [currentOccupancy, setCurrentOccupancy] = useState(0)
  const [maxCapacity, setMaxCapacity] = useState(50)
  
  // V7.9 Fix #2: Trigger for occupancy refresh
  const [occupancyRefreshTrigger, setOccupancyRefreshTrigger] = useState(0)

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
          // V7.8: Load max capacity
          setMaxCapacity(data.max_capacity || 50)
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

  // V7.8 Feature #1: Load real-time occupancy counter
  // V7.9 Fix #2: Refresh when trigger changes
  useEffect(() => {
    const loadOccupancyCounter = async () => {
      try {
        const response = await fetch('/api/occupancy')
        if (response.ok) {
          const data = await response.json()
          setCurrentOccupancy(data.total || 0)
        }
      } catch (error) {
        console.error('Error loading occupancy counter:', error)
      }
    }

    loadOccupancyCounter()

    // Poll for occupancy updates every 5 seconds
    const interval = setInterval(loadOccupancyCounter, 5000)

    return () => clearInterval(interval)
  }, [occupancyRefreshTrigger])

  // V7.9 Fix #2: Auto-refresh 'People Currently Inside' modal
  // V8.6 Fix #2: Use silent refresh for polling (no loading spinner flash)
  useEffect(() => {
    // Only refresh if modal is open
    if (showOccupancyPanel) {
      loadOccupancy() // Show spinner on initial open
    }
    
    // Set up interval to refresh every 5 seconds when modal is open
    if (showOccupancyPanel) {
      const interval = setInterval(() => {
        loadOccupancy(true) // Silent refresh for polling
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [showOccupancyPanel, occupancyRefreshTrigger])

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
          // V8.3 Fix #1: Visitor pass - auto-commit after successful check_only
          // Store visitor pass info for display
          setUserInfo({ 
            name: data.user_name, 
            id: data.user_id,
            current_location: 'OUTSIDE',
            active_guests: 0,
            personal_guest_limit: null,
            property_max_guests: 0,
            user_type: 'visitor_pass' // V7.8: Mark as visitor pass
          })
          
          // V8.3 CRITICAL FIX: Immediately fire check_only:false to commit the scan
          await commitVisitorPassScan(decodedText, data.user_name, data.is_re_entry)
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
        
        // V7.9 Fix #2: Trigger occupancy refresh after successful scan
        setOccupancyRefreshTrigger(prev => prev + 1)
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

  // V8.3 Fix #1: Commit visitor pass scan after check_only validation
  const commitVisitorPassScan = async (qrCode: string, userName: string, isReEntry: boolean) => {
    try {
      // Fire the actual scan with check_only:false (default)
      const response = await fetch('/api/check-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_code: qrCode,
          scan_type: mode,
          guest_count: 0 // Visitor passes always 0 guests
        }),
      })

      const data = await response.json()

      if (data.can_access) {
        setScanResult('success')
        // V7.9 Fix #1: Different message for re-entry
        setMessage(isReEntry ? 'WELCOME BACK' : 'Access Granted')
        
        // V7.9 Fix #2: Trigger occupancy refresh after visitor pass scan
        setOccupancyRefreshTrigger(prev => prev + 1)
        
        console.log('✓ Visitor pass scan committed to database')
      } else {
        setScanResult('denied')
        setMessage(data.denial_reason || 'Access Denied')
      }
      
      setTimeout(resetScanner, 3000)
    } catch (error) {
      console.error('Visitor pass commit error:', error)
      setScanResult('error')
      setMessage('System Error')
      setTimeout(resetScanner, 3000)
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
  
  // V8.0 Requirement #1: Load unified occupancy (residents + visitors)
  // V8.6 Fix #2: Add silent parameter for background polling (no loading spinner)
  const loadOccupancy = async (silent = false) => {
    if (!silent) {
      setLoadingOccupancy(true)
    }
    try {
      const response = await fetch('/api/occupancy-list')
      if (response.ok) {
        const data = await response.json()
        setInsideResidents(data.occupants || [])
      }
    } catch (error) {
      console.error('Error loading occupancy:', error)
    } finally {
      if (!silent) {
        setLoadingOccupancy(false)
      }
    }
  }
  
  // V8.4 Fix #3: Force exit handles both residents and visitors
  const forceExit = async (personId: string, isVisitor: boolean = false) => {
    if (!confirm('Force exit this person?')) return
    
    try {
      if (isVisitor) {
        // Force exit visitor pass
        const response = await fetch('/api/guest-passes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: personId,
            is_inside: false,
          }),
        })
        if (!response.ok) throw new Error('Failed to exit visitor')
      } else {
        // Force exit resident
        const response = await fetch('/api/residents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: personId,
            current_location: 'OUTSIDE',
            active_guests: 0,
          }),
        })
        if (!response.ok) throw new Error('Failed to exit resident')
      }
      
      // Reload occupancy list
      await loadOccupancy()
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
  
  // V7.8 Feature #3: Log pool status changes to activity log
  const logStatusChange = async (newStatus: string, source: string, reason: string) => {
    try {
      await fetch('/api/log-status-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_status: newStatus,
          source,
          reason
        }),
      })
    } catch (error) {
      console.error('Error logging status change:', error)
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
        const newStatus = isPoolOpen ? 'CLOSED' : 'OPENED'
        setIsPoolOpen(!isPoolOpen)
        setCloseReason(isPoolOpen ? reason : '')
        
        // V7.8 Feature #3: Log status change to activity log
        await logStatusChange(newStatus, 'Scanner', reason)
        
        alert(`Pool ${newStatus} successfully!`)
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
        <div className="max-w-7xl mx-auto">
          {/* Top Row: Logo & Controls */}
          <div className="flex items-center justify-between mb-3">
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
          
          {/* V7.8 Feature #1: High-Visibility Occupancy Counter */}
          <div className="bg-gradient-to-r from-teal-600/20 to-blue-600/20 border border-teal-500/30 rounded-lg px-6 py-3 flex items-center justify-center gap-3">
            <Users className="w-6 h-6 text-teal-400" />
            <div className="text-center">
              <p className="text-sm text-white/70 font-medium">Pool Occupancy</p>
              <p className="text-2xl font-bold">
                <span className={currentOccupancy >= maxCapacity ? 'text-red-400' : 'text-teal-400'}>
                  {currentOccupancy}
                </span>
                <span className="text-white/50"> / </span>
                <span className="text-white">{maxCapacity}</span>
              </p>
            </div>
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
      <div className="flex flex-col items-center justify-center px-4 pb-8 relative">
        {/* V8.0 Requirement #3: Pool Closed Overlay */}
        {!isPoolOpen && (
          <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center rounded-2xl">
            <div className="text-center p-8">
              <div className="text-8xl mb-6">⛔</div>
              <h2 className="text-5xl font-bold text-red-500 mb-4">FACILITY CLOSED</h2>
              <p className="text-white text-xl">{closeReason || 'Pool is currently closed for maintenance'}</p>
            </div>
          </div>
        )}
        
        {!isScanning && scanResult === 'idle' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center max-w-md">
            <Camera className="w-20 h-20 mx-auto mb-4 text-teal-400" />
            <h2 className="text-2xl font-bold mb-2">Ready to Scan</h2>
            <p className="text-white/80 mb-6">
              Tap below to start scanning QR codes
            </p>
            <button
              onClick={startScanner}
              disabled={!isPoolOpen}
              className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${
                !isPoolOpen 
                  ? 'bg-gray-600 cursor-not-allowed opacity-50' 
                  : 'bg-teal-600 hover:bg-teal-700 text-white'
              }`}
            >
              {!isPoolOpen ? 'Scanner Disabled' : 'Start Scanner'}
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
            
            {/* V7.8 Feature #2: Visitor Pass Warning */}
            {userInfo?.user_type === 'visitor_pass' && (
              <div className="mt-6 pt-6 border-t-2 border-white/30">
                <div className="bg-yellow-500/20 border-2 border-yellow-300 rounded-xl p-4 mb-3">
                  <p className="text-sm font-bold text-yellow-100 mb-1">TYPE: VISITOR PASS</p>
                  <p className="text-xs text-yellow-200">⚠️ VALID FOR 1 PERSON ONLY</p>
                </div>
                <p className="text-sm text-white/80">This pass grants entry for a single visitor.</p>
              </div>
            )}
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
                      {insideResidents.map((occupant: any) => {
                        // V8.4 Fix #3: Support both residents and visitor passes with Force Exit
                        const isVisitor = occupant.type === 'visitor'
                        const totalPeople = occupant.total_people || 1
                        const displayName = isVisitor 
                          ? `Visitor Pass (Guest of ${occupant.purchaser_name || 'Unknown'})`
                          : occupant.name
                        return (
                          <tr key={occupant.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-900 font-semibold">
                              {displayName}
                              {isVisitor && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">VISITOR</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-700">{isVisitor ? occupant.purchaser_unit : occupant.unit}</td>
                            <td className="px-4 py-3 text-center">
                              {isVisitor ? (
                                <span className="text-gray-400">—</span>
                              ) : (
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                                  +{occupant.active_guests || 0}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-900 font-bold">{totalPeople}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => forceExit(occupant.id, isVisitor)}
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

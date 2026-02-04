'use client'

import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, X, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

type ScanMode = 'ENTRY' | 'EXIT'
type ScanResult = 'idle' | 'scanning' | 'success' | 'denied' | 'error'

export default function ScannerPage() {
  const [mode, setMode] = useState<ScanMode>('ENTRY')
  const [scanResult, setScanResult] = useState<ScanResult>('idle')
  const [message, setMessage] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  const [isScanning, setIsScanning] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

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
      
      // Wait for DOM element to be available
      const checkElement = () => {
        return new Promise<void>((resolve, reject) => {
          const maxAttempts = 20
          let attempts = 0
          
          const check = () => {
            const element = document.getElementById('qr-reader')
            if (element) {
              resolve()
            } else if (attempts >= maxAttempts) {
              reject(new Error('QR reader element not found after multiple attempts'))
            } else {
              attempts++
              setTimeout(check, 100)
            }
          }
          
          check()
        })
      }

      // Set scanning state first to render the DOM element
      setIsScanning(true)
      
      // Wait for the element to exist
      await checkElement()
      
      // Now initialize the scanner
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onScanSuccess,
        () => {
          // Silent fail for scan errors (no QR code detected)
        }
      )
    } catch (error) {
      console.error('Error starting scanner:', error)
      setIsScanning(false)
      setCameraError('Unable to access camera. Please grant camera permissions and ensure you are using HTTPS.')
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop()
      setIsScanning(false)
    }
  }

  const onScanSuccess = async (decodedText: string) => {
    // Stop scanning immediately
    await stopScanner()

    setScanResult('scanning')
    setMessage('Checking access...')

    try {
      const response = await fetch('/api/check-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_code: decodedText,
          scan_type: mode,
        }),
      })

      const data = await response.json()

      if (data.can_access) {
        setScanResult('success')
        setUserName(data.user_name || 'Guest')
        setMessage(
          mode === 'ENTRY'
            ? '✓ Access Granted - Welcome!'
            : '✓ Exit Recorded - Have a great day!'
        )
      } else {
        setScanResult('denied')
        setUserName(data.user_name || 'Unknown')
        setMessage(data.denial_reason || 'Access Denied')
      }
    } catch (error) {
      console.error('Error checking access:', error)
      setScanResult('error')
      setMessage('System Error - Please try again')
    }

    // Reset after 3 seconds
    setTimeout(() => {
      setScanResult('idle')
      setMessage('')
      setUserName('')
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-teal-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-teal-500 p-2 rounded-lg">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Secure Access Pass</h1>
              <p className="text-sm text-white/70">Pool Access Scanner</p>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="bg-white/20 rounded-lg p-1 flex gap-1">
            <button
              onClick={() => setMode('ENTRY')}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                mode === 'ENTRY'
                  ? 'bg-teal-500 text-white shadow-lg'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              ENTRY
            </button>
            <button
              onClick={() => setMode('EXIT')}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                mode === 'EXIT'
                  ? 'bg-navy-600 text-white shadow-lg'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              EXIT
            </button>
          </div>
        </div>
      </div>

      {/* Main Scanner Area */}
      <div className="max-w-4xl mx-auto p-6">
        {scanResult === 'idle' && !isScanning && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center border border-white/20">
            <Camera className="w-24 h-24 text-white/50 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-white mb-4">
              Ready to Scan
            </h2>
            <p className="text-white/70 mb-8">
              {mode === 'ENTRY'
                ? 'Tap below to scan resident QR code for pool entry'
                : 'Tap below to scan resident QR code for pool exit'}
            </p>
            <button
              onClick={startScanner}
              className="bg-teal-500 hover:bg-teal-600 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
            >
              Start Scanner
            </button>
          </div>
        )}

        {/* Camera Preview */}
        {isScanning && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden border border-white/20">
            <div id="qr-reader" className="w-full"></div>
            <div className="p-6 text-center">
              <p className="text-white/90 mb-4">Position QR code within the frame</p>
              <button
                onClick={stopScanner}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 mx-auto"
              >
                <X className="w-5 h-5" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Camera Error */}
        {cameraError && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-red-200 font-semibold mb-1">Camera Access Required</h3>
                <p className="text-red-300 text-sm">{cameraError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Scanning State */}
        {scanResult === 'scanning' && (
          <div className="fixed inset-0 bg-navy-950/95 backdrop-blur-md flex items-center justify-center z-50">
            <div className="text-center">
              <Loader2 className="w-20 h-20 text-teal-400 animate-spin mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-white mb-2">
                {message}
              </h2>
            </div>
          </div>
        )}

        {/* Success State */}
        {scanResult === 'success' && (
          <div className="fixed inset-0 scanner-green flex items-center justify-center z-50 pulse-success">
            <div className="text-center px-6">
              <CheckCircle2 className="w-32 h-32 text-white mx-auto mb-8 drop-shadow-2xl" />
              <h2 className="text-5xl font-bold text-white mb-4 drop-shadow-lg">
                {message}
              </h2>
              <p className="text-3xl font-semibold text-white/90 drop-shadow-lg">
                {userName}
              </p>
            </div>
          </div>
        )}

        {/* Denied State */}
        {scanResult === 'denied' && (
          <div className="fixed inset-0 scanner-red flex items-center justify-center z-50 pulse-error">
            <div className="text-center px-6">
              <XCircle className="w-32 h-32 text-white mx-auto mb-8 drop-shadow-2xl" />
              <h2 className="text-5xl font-bold text-white mb-4 drop-shadow-lg">
                ACCESS DENIED
              </h2>
              <p className="text-3xl font-semibold text-white/90 drop-shadow-lg mb-2">
                {userName}
              </p>
              <p className="text-2xl font-medium text-white/80 drop-shadow-lg">
                {message}
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {scanResult === 'error' && (
          <div className="fixed inset-0 bg-orange-600 flex items-center justify-center z-50">
            <div className="text-center px-6">
              <XCircle className="w-32 h-32 text-white mx-auto mb-8 drop-shadow-2xl" />
              <h2 className="text-5xl font-bold text-white mb-4 drop-shadow-lg">
                SYSTEM ERROR
              </h2>
              <p className="text-2xl font-medium text-white/90 drop-shadow-lg">
                {message}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { 
  QrCode,
  Download,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'

interface GuestPassData {
  id: string
  qr_code: string
  guest_name: string | null
  guest_email: string | null
  guest_phone: string | null
  status: 'active' | 'used' | 'expired' | 'cancelled'
  expires_at: string | null
  used_at: string | null
  is_inside: boolean
  purchaser: {
    name: string
    unit: string
  } | null
  property: {
    name: string
    property_name: string
    address: string
    city: string
    state: string
  } | null
}

export default function GuestPassPage() {
  const params = useParams()
  const id = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [guestPass, setGuestPass] = useState<GuestPassData | null>(null)

  useEffect(() => {
    loadGuestPass()
  }, [id])

  const loadGuestPass = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/guest-passes/${id}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Guest pass not found')
        } else {
          setError('Failed to load guest pass')
        }
        setLoading(false)
        return
      }

      const data = await response.json()
      setGuestPass(data)
    } catch (error) {
      console.error('Error loading guest pass:', error)
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const downloadQR = () => {
    const canvas = document.getElementById('guest-qr-canvas') as HTMLCanvasElement
    if (canvas && guestPass) {
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `Guest-Pass-${guestPass.id.substring(0, 8)}.png`
      link.href = url
      link.click()
    }
  }

  // V8.8 Fix #2 & #3: Handle null expires_at and 'used' passes correctly
  const isExpired = guestPass && guestPass.expires_at && (new Date(guestPass.expires_at) < new Date() || guestPass.status === 'expired')
  const isCancelled = guestPass?.status === 'cancelled'
  const isActive = guestPass?.status === 'active' && !guestPass?.used_at
  const isUsedAndStillValid = guestPass?.status === 'used' && guestPass.expires_at && new Date(guestPass.expires_at) > new Date()
  const isUsed = guestPass?.status === 'used' && (!guestPass.expires_at || new Date(guestPass.expires_at) < new Date())
  const isValid = guestPass && !isExpired && !isCancelled && (isActive || isUsedAndStillValid)

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-teal-900 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-lg font-semibold">Loading guest pass...</p>
        </div>
      </div>
    )
  }

  // Error State
  if (error || !guestPass) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-teal-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-navy-900 mb-2">Visitor Pass Not Found</h1>
          <p className="text-navy-600">
            {error || 'This visitor pass does not exist or has been deleted.'}
          </p>
        </div>
      </div>
    )
  }

  // Valid Guest Pass
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-teal-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isValid 
              ? 'bg-green-100' 
              : isUsed 
              ? 'bg-gray-100' 
              : 'bg-red-100'
          }`}>
            <Shield className={`w-10 h-10 ${
              isValid 
                ? 'text-green-600' 
                : isUsed 
                ? 'text-gray-600' 
                : 'text-red-600'
            }`} />
          </div>
          <h1 className="text-3xl font-bold text-navy-900 mb-2">
            {guestPass.property?.name || guestPass.property?.property_name || 'Pool'} Visitor Pass
          </h1>
          <p className="text-navy-600">
            {guestPass.guest_name ? `For ${guestPass.guest_name}` : 'Single-Use Access'}
          </p>
          {guestPass.purchaser && (
            <p className="text-sm text-navy-500">
              Invited by {guestPass.purchaser.name} (Unit {guestPass.purchaser.unit})
            </p>
          )}
        </div>

        {/* Status Badge */}
        <div className={`mb-6 p-4 rounded-lg border-2 ${
          isActive 
            ? 'bg-green-50 border-green-300' 
            : isUsedAndStillValid
            ? 'bg-blue-50 border-blue-300'
            : 'bg-red-50 border-red-300'
        }`}>
          <div className="flex items-center gap-2 justify-center">
            {isActive ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">Ready to Use</span>
              </>
            ) : isUsedAndStillValid ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-800">Active - Valid for Re-entry</span>
              </>
            ) : isCancelled ? (
              <>
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="font-semibold text-red-800">Cancelled</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="font-semibold text-red-800">Expired</span>
              </>
            )}
          </div>
          
          <div className="text-center text-sm mt-2">
            {isActive ? (
              <div className="flex items-center gap-2 justify-center text-navy-600">
                <Clock className="w-4 h-4" />
                <span>Valid for 1 Day upon entry</span>
              </div>
            ) : isUsedAndStillValid && guestPass.expires_at ? (
              <div className="flex items-center gap-2 justify-center text-navy-600">
                <Clock className="w-4 h-4" />
                <span>Valid until {new Date(guestPass.expires_at).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
              </div>
            ) : isExpired && guestPass.expires_at ? (
              <div className="text-navy-600">
                Expired on {new Date(guestPass.expires_at).toLocaleString()}
              </div>
            ) : null}
          </div>
        </div>

        {/* QR Code */}
        <div className="text-center mb-6">
          <div className={`bg-white p-6 rounded-xl border-4 inline-block mb-4 ${
            isValid ? 'border-green-600' : 'border-gray-400 opacity-50'
          }`}>
            <QRCodeCanvas
              id="guest-qr-canvas"
              value={guestPass.qr_code}
              size={220}
              level="H"
            />
          </div>
          
          {isValid && (
            <p className="text-sm text-navy-600 mb-4">
              Show this QR code to the scanner at the pool entrance
            </p>
          )}
          
          {!isValid && (
            <p className="text-sm text-red-600 mb-4">
              This pass cannot be used for entry
            </p>
          )}

          {isValid && (
            <button
              onClick={downloadQR}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2 mx-auto"
            >
              <Download className="w-5 h-5" />
              Save QR Code
            </button>
          )}
        </div>

        {/* V8.1 Feature #4: Updated terminology and simplified text */}
        {isValid && (
          <div className="text-center text-navy-700">
            <p className="italic">Valid for multiple entries until 11:59 PM today.</p>
          </div>
        )}

        {/* Contact Info (if provided) */}
        {(guestPass.guest_email || guestPass.guest_phone) && (
          <div className="mt-4 text-center text-sm text-navy-600">
            {guestPass.guest_email && <p>Email: {guestPass.guest_email}</p>}
            {guestPass.guest_phone && <p>Phone: {guestPass.guest_phone}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

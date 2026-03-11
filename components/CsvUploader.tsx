'use client'

import { useState } from 'react'
import { Upload, X, CheckCircle2, AlertCircle, FileSpreadsheet, Mail, Loader2 } from 'lucide-react'

interface CsvUploaderProps {
  onUploadComplete: () => void
  propertyId: string // V10.8.1: Multi-tenancy support
}

interface ParsedResident {
  name: string
  email: string
  unit: string
  phone?: string
  guest_limit?: number // V10.8.64: Optional guest limit from CSV
}

export default function CsvUploader({ onUploadComplete, propertyId }: CsvUploaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false) // V10.8.7: Drag-and-drop state
  const [results, setResults] = useState<{
    success: any[]
    failed: any[]
  } | null>(null)
  // V10.8.8: Post-upload invite flow
  const [showSuccessScreen, setShowSuccessScreen] = useState(false)
  const [isSendingInvites, setIsSendingInvites] = useState(false)
  const [invitesSent, setInvitesSent] = useState(false)

  // V10.8.64: Smart CSV header mapping
  const normalizeHeader = (header: string): string => {
    const h = header.toLowerCase().trim()
    // Map unit variations
    if (['unit_number', 'unit#', 'apt'].includes(h)) return 'unit'
    // Map phone variations
    if (['phone_number', 'mobile', 'cell'].includes(h)) return 'phone'
    // Map name variations
    if (['full_name', 'resident_name'].includes(h)) return 'name'
    return h
  }

  const parseCSV = (text: string): ParsedResident[] => {
    const lines = text.trim().split('\n')
    
    if (lines.length < 2) {
      throw new Error('CSV file must contain at least a header row and one data row')
    }

    // Parse header with smart mapping
    const rawHeader = lines[0].split(',').map(h => h.trim())
    const header = rawHeader.map(normalizeHeader)
    
    // Validate required columns
    const requiredColumns = ['name', 'unit', 'email']
    const missingColumns = requiredColumns.filter(col => !header.includes(col))
    
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}. CSV must have: name, unit, email (phone and guest_limit are optional)`)
    }

    // Parse data rows
    const residents: ParsedResident[] = []
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue // Skip empty lines
      
      const values = line.split(',').map(v => v.trim())
      const resident: any = {}
      
      header.forEach((col, idx) => {
        resident[col] = values[idx] || ''
      })
      
      // V10.8.64: Validate required fields and include optional guest_limit
      if (resident.name && resident.email && resident.unit) {
        residents.push({
          name: resident.name,
          email: resident.email,
          unit: resident.unit,
          phone: resident.phone || undefined,
          guest_limit: resident.guest_limit ? parseInt(resident.guest_limit) : undefined,
        })
      }
    }

    if (residents.length === 0) {
      throw new Error('No valid residents found in CSV file')
    }

    return residents
  }

  // V10.8.7: Unified file processing for both click and drag-and-drop
  const processFile = async (file: File) => {
    if (!file) return

    setIsProcessing(true)
    setResults(null)

    try {
      // Read file
      const text = await file.text()
      
      // Parse CSV
      const residents = parseCSV(text)
      
      // V10.8.1: Upload to API with property_id for multi-tenancy
      const response = await fetch('/api/residents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residents, property_id: propertyId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload residents')
      }

      setResults(data.results)
      
      // V10.8.8: Show success screen instead of auto-closing
      if (data.results.success.length > 0) {
        setShowSuccessScreen(true)
      }
    } catch (error) {
      console.error('CSV upload error:', error)
      alert(error instanceof Error ? error.message : 'Failed to process CSV file')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    await processFile(file!)
    event.target.value = '' // Reset file input
  }

  // V10.8.7: Drag-and-drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file && file.type === 'text/csv') {
      await processFile(file)
    } else {
      alert('Please drop a valid CSV file')
    }
  }

  // V10.8.8: Send welcome invites after successful upload
  const sendInvites = async () => {
    setIsSendingInvites(true)
    
    // Simulate API call delay (1.5 seconds)
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    setIsSendingInvites(false)
    setInvitesSent(true)
  }

  // V10.8.8: Close modal and reset all state
  const closeModal = () => {
    setIsOpen(false)
    setResults(null)
    setShowSuccessScreen(false)
    setInvitesSent(false)
    setIsSendingInvites(false)
    // Notify parent to reload data
    if (showSuccessScreen) {
      onUploadComplete()
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-navy-600 hover:bg-navy-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
      >
        <Upload className="w-5 h-5" />
        Import CSV
      </button>

      {/* V10.8.7: Polished Modal with click-outside-to-close */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            // V10.8.8: Close modal with proper cleanup
            if (e.target === e.currentTarget) {
              closeModal()
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* V10.8.7: Sticky Header */}
            <div className="sticky top-0 bg-gradient-to-r from-navy-900 to-navy-800 text-white p-5 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5" />
                  <h2 className="text-xl font-bold">Bulk Import Residents</h2>
                </div>
                <button
                  onClick={closeModal}
                  className="text-white/70 hover:text-white transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-auto p-6">
              {/* V10.8.7: Compact Instructions */}
              {/* V10.8.64: Added sample download and smart mapping info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-navy-700 mb-2">
                  <strong>Required columns:</strong> name, email, unit (phone and guest_limit are optional)
                </p>
                <p className="text-xs text-navy-600 mb-2">
                  Smart mapping: unit_number→unit, phone_number/mobile/cell→phone, full_name→name
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const csv = 'name,email,unit,phone,guest_limit\nJohn Doe,john@example.com,101,555-1234,3\nJane Smith,jane@example.com,102,555-5678,5'
                      const blob = new Blob([csv], { type: 'text/csv' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'residents_sample.csv'
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="text-xs bg-white hover:bg-navy-50 text-navy-700 px-3 py-1.5 rounded border border-navy-300 font-medium transition-colors"
                  >
                    📥 Download Sample CSV
                  </button>
                  <details className="text-xs text-navy-600">
                    <summary className="cursor-pointer hover:text-navy-900 font-medium">View example format</summary>
                    <pre className="bg-white p-2 rounded mt-2 text-xs">
name,email,unit,phone,guest_limit{'\n'}
John Doe,john@example.com,101,555-1234,3{'\n'}
Jane Smith,jane@example.com,102,555-5678,5
                    </pre>
                  </details>
                </div>
              </div>

              {/* V10.8.7: Drag-and-Drop Upload Section */}
              {!results && (
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                    isDragging 
                      ? 'border-teal-500 bg-teal-50' 
                      : 'border-navy-300 bg-white'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-teal-600' : 'text-navy-400'}`} />
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      disabled={isProcessing}
                      className="hidden"
                    />
                    <span className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold inline-block transition-all">
                      {isProcessing ? 'Processing...' : 'Choose CSV File'}
                    </span>
                  </label>
                  <p className="text-sm text-navy-600 mt-3">
                    or drag and drop your CSV file here
                  </p>
                </div>
              )}

              {/* V10.8.8: Success Screen with Invite Flow */}
              {results && showSuccessScreen && (
                <div className="space-y-6">
                  {/* Success Message */}
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                      <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-navy-900 mb-2">
                      {results.success.length} Residents Imported Successfully!
                    </h3>
                    <p className="text-navy-600">
                      All residents have been added with secure 6-digit PINs
                    </p>
                  </div>

                  {/* Resident List */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-h-40 overflow-auto">
                    <div className="text-sm text-green-700 space-y-1">
                      {results.success.map((resident, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                          <span>{resident.name} - Unit {resident.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Failed Imports (if any) */}
                  {results.failed.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-red-900 mb-1">
                            {results.failed.length} Failed
                          </h4>
                          <div className="text-sm text-red-700 max-h-32 overflow-auto">
                            {results.failed.map((item, idx) => (
                              <div key={idx} className="py-1">
                                {item.data.name || 'Unknown'} - {item.error}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Invite Flow */}
                  {!invitesSent ? (
                    <button
                      onClick={sendInvites}
                      disabled={isSendingInvites}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white px-6 py-4 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSendingInvites ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Sending Invites...</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-5 h-5" />
                          <span>✉️ Send Welcome Emails & PINs</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <>
                      <div className="bg-teal-50 border-2 border-teal-200 rounded-lg p-4 text-center">
                        <CheckCircle2 className="w-8 h-8 text-teal-600 mx-auto mb-2" />
                        <p className="text-teal-900 font-semibold">
                          ✅ Invites Sent!
                        </p>
                        <p className="text-sm text-teal-700 mt-1">
                          Welcome emails with portal links and PINs have been sent to all residents
                        </p>
                      </div>
                      <button
                        onClick={closeModal}
                        className="w-full bg-navy-600 hover:bg-navy-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                      >
                        Done / Close
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* V10.8.8: Old results view (only if not showing success screen) */}
              {results && !showSuccessScreen && (
                <div className="space-y-4">
                  {/* Success */}
                  {results.success.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-green-900 mb-1">
                            Successfully Imported: {results.success.length}
                          </h4>
                          <div className="text-sm text-green-700 max-h-40 overflow-auto">
                            {results.success.map((resident, idx) => (
                              <div key={idx} className="py-1">
                                {resident.name} - Unit {resident.unit}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Failures */}
                  {results.failed.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-red-900 mb-1">
                            Failed to Import: {results.failed.length}
                          </h4>
                          <div className="text-sm text-red-700 max-h-40 overflow-auto">
                            {results.failed.map((item, idx) => (
                              <div key={idx} className="py-1">
                                {item.data.name || 'Unknown'} - {item.error}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setResults(null)
                        setIsOpen(false)
                      }}
                      className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                    >
                      Done
                    </button>
                    <button
                      onClick={() => setResults(null)}
                      className="flex-1 bg-navy-200 hover:bg-navy-300 text-navy-900 px-6 py-3 rounded-lg font-semibold transition-all"
                    >
                      Import Another
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

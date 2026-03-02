'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, Lock, Loader2, Building2 } from 'lucide-react'

export default function ManagerLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // V10.8.11: Mock manager login - accepts any input
  // V10.8.12: Smart routing based on property count
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim() || !password.trim()) {
      alert('Please enter email and password')
      return
    }
    
    setIsLoading(true)
    
    try {
      // Simulate 1-second loading
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Fetch user's properties to determine routing
      const response = await fetch('/api/portfolio')
      if (response.ok) {
        const data = await response.json()
        const propertyCount = data.properties?.length || 0
        
        console.log('[V10.8.12] Login: Found', propertyCount, 'properties')
        
        // Smart routing based on property count
        if (propertyCount > 1) {
          // Multiple properties - show portfolio view
          router.push('/dashboard/portfolio')
        } else if (propertyCount === 1) {
          // Single property - go directly to dashboard
          const firstProperty = data.properties[0]
          localStorage.setItem('selectedPropertyId', firstProperty.id)
          router.push('/dashboard?tab=overview')
        } else {
          // No properties - still go to dashboard, let it handle the no-property state
          router.push('/dashboard?tab=overview')
        }
      } else {
        // Fallback to dashboard if API fails
        router.push('/dashboard?tab=overview')
      }
    } catch (error) {
      console.error('Login routing error:', error)
      // Fallback to dashboard
      router.push('/dashboard?tab=overview')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-teal-900 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10"></div>
      
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-teal-500 rounded-2xl mb-4 shadow-2xl">
            <Shield className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Secure Access Pass</h1>
          <p className="text-white/70 text-sm">Manager Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-teal-500/20 rounded-lg">
              <Building2 className="w-6 h-6 text-teal-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Manager Login</h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@secureaccess.com"
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>Login</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-center text-white/60 text-sm">
              Demo credentials: <span className="text-white/80 font-mono">admin@secureaccess.com</span> / <span className="text-white/80 font-mono">demo</span>
            </p>
          </div>
        </div>

        {/* Resident Access Link */}
        <div className="mt-6 text-center">
          <Link
            href="/resident"
            className="text-white/70 hover:text-white text-sm font-medium transition-colors inline-flex items-center gap-1"
          >
            <Shield className="w-4 h-4" />
            Resident Access Portal →
          </Link>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-white/40 text-xs">
          © 2024 Secure Access Pass • Resort-grade digital entry solution
        </p>
      </div>
    </div>
  )
}

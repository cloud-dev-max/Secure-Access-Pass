import Link from 'next/link'
import { Shield, QrCode, Users, Lock, CheckCircle2, Waves } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-teal-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-teal-500 p-2 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Secure Access Pass</span>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="bg-white/20 hover:bg-white/30 text-white px-6 py-2 rounded-lg font-semibold transition-all"
            >
              Manager Dashboard
            </Link>
            <Link
              href="/scanner"
              className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-semibold transition-all"
            >
              Open Scanner
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Waves className="w-12 h-12 text-teal-400" />
            <h1 className="text-6xl font-bold text-white">
              Secure Access Pass
            </h1>
          </div>
          <p className="text-2xl text-white/80 mb-8">
            Resort-Grade Digital Entry Solution for Swimming Pool Access
          </p>
          <p className="text-lg text-white/60 max-w-3xl mx-auto">
            Replace physical key fobs with mobile QR codes. Instantly manage access with custom rules.
            Monitor who's in your pool in real-time.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 hover:bg-white/20 transition-all">
            <div className="bg-teal-500 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
              <QrCode className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">QR Code Access</h3>
            <p className="text-white/70">
              No more physical key fobs. Every resident gets a unique QR code that can't be shared or duplicated.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 hover:bg-white/20 transition-all">
            <div className="bg-navy-500 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Dynamic Rules</h3>
            <p className="text-white/70">
              Create custom access rules like "Rent Paid" or "Lease Compliant". Instantly revoke access with one click.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 hover:bg-white/20 transition-all">
            <div className="bg-teal-500 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Anti-Passback</h3>
            <p className="text-white/70">
              Prevents residents from sharing access. Once inside, their QR code is locked until they exit.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-12 border border-white/20">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-teal-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">
                1
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">Create Custom Rules</h4>
              <p className="text-white/70">
                Define access requirements like "Rent Paid", "Pet Deposit", or any custom rule.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-teal-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">
                2
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">Manage Residents</h4>
              <p className="text-white/70">
                Add residents and toggle their access rules on/off with a simple click.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-teal-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">
                3
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">Scan & Control</h4>
              <p className="text-white/70">
                Use the scanner app to verify access. The system enforces all rules automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Key Benefits */}
        <div className="mt-16 bg-gradient-to-r from-teal-500 to-navy-600 rounded-2xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-8 text-center">Key Benefits</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold mb-1">Instant Access Control</h4>
                <p className="text-white/90">Revoke or grant access in seconds, not days.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold mb-1">No Physical Keys</h4>
                <p className="text-white/90">Eliminate the cost and hassle of physical key fobs.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold mb-1">Complete Audit Trail</h4>
                <p className="text-white/90">Track every entry and exit with detailed logs.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold mb-1">Flexible Rules Engine</h4>
                <p className="text-white/90">Create unlimited custom rules for any scenario.</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Ready to Get Started?</h2>
          <div className="flex gap-4 justify-center">
            <Link
              href="/dashboard"
              className="bg-teal-500 hover:bg-teal-600 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
            >
              Open Manager Dashboard
            </Link>
            <Link
              href="/scanner"
              className="bg-white/20 hover:bg-white/30 text-white px-8 py-4 rounded-xl text-lg font-semibold border-2 border-white/40 transition-all transform hover:scale-105"
            >
              Launch Scanner App
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white/5 backdrop-blur-md border-t border-white/10 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-white/60">
          <p>© 2024 Secure Access Pass. Resort-grade digital entry solution.</p>
        </div>
      </footer>
    </div>
  )
}

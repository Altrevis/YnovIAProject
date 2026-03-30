export default function Navbar() {
  return (
    <nav className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-white px-8 py-3 shadow-2xl backdrop-blur-sm border-b border-amber-500/30 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-white to-amber-100 rounded-2xl flex items-center justify-center font-bold text-lg text-amber-700 shadow-lg transform hover:scale-105 transition-transform">
            AI
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-amber-100 bg-clip-text text-transparent">
              ChatBot IA
            </h1>
            <p className="text-xs text-amber-100 font-medium">Analyse intelligente en temps réel</p>
          </div>
        </div>
      </div>
    </nav>
  );
}

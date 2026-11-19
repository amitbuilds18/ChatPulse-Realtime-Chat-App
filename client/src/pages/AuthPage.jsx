import React, { useState } from "react";
import { MessageSquare, Lock, Mail, User, Eye, EyeOff, Sparkles, ArrowRight, ShieldCheck, Phone } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) throw new Error("Please enter your email address.");
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");

      if (isRegister) {
        if (!name.trim()) throw new Error("Full name is required.");
        await register(name.trim(), cleanEmail, password, phone.trim() || undefined);
      } else {
        await login(cleanEmail, password);
      }
    } catch (err) {
      if (err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        setError("Cannot connect to backend server at http://localhost:5001. Please ensure backend is running ('npm run dev' inside server/).");
      } else {
        setError(err.response?.data?.error || err.message || "Authentication failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Quick autofill demo accounts for instant testing
  const handleQuickDemo = (demoName, demoEmail) => {
    if (isRegister) {
      setName(demoName);
    }
    setEmail(demoEmail);
    setPassword("password123");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.25),rgba(16,185,129,0.15),rgba(255,255,255,0))]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Branding Logo */}
        <div className="text-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center mx-auto mb-3.5 shadow-xl shadow-indigo-500/25">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            ChatPulse Messenger
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
              Task 04
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sign in with your Gmail/Email • CodeCraft Infotech Internship
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900/85 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-black/60">
          {/* Toggle Pills */}
          <div className="flex p-1 bg-slate-950/80 rounded-2xl border border-slate-800/80 mb-6">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setError(""); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
                !isRegister
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Sign In (Email)
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setError(""); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
                isRegister
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Amit Kumar"
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 outline-none transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Email Address (Gmail)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 outline-none transition"
                />
              </div>
            </div>

            {isRegister && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Mobile Number <span className="text-slate-500 font-normal">(Optional for SMS delivery)</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 outline-none transition font-mono"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-600 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-semibold text-xs py-3 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>{isRegister ? "Create Account with Email" : "Sign In to Messenger"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Accounts for Instant Testing */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <p className="text-[11px] text-slate-400 flex items-center justify-between mb-2.5 font-medium">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Instant Demo Accounts:
              </span>
              <span className="text-[10px] text-slate-400 font-mono">pass: password123</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo("Amit Kumar", "amit@codecraft.com")}
                className="text-left p-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-950/20 transition cursor-pointer text-[11px]"
              >
                <div className="font-semibold text-slate-200">Amit Kumar</div>
                <div className="text-[10px] text-indigo-400 font-mono truncate">amit@codecraft.com</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo("Rahul Sharma", "rahul@codecraft.com")}
                className="text-left p-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-violet-500/50 hover:bg-violet-950/20 transition cursor-pointer text-[11px]"
              >
                <div className="font-semibold text-slate-200">Rahul Sharma</div>
                <div className="text-[10px] text-violet-400 font-mono truncate">rahul@codecraft.com</div>
              </button>
            </div>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="text-center mt-6 flex items-center justify-center gap-2 text-xs text-slate-400 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Stateless JWT Bearer Auth • Neon Cloud PostgreSQL</span>
        </div>
      </div>
    </div>
  );
}

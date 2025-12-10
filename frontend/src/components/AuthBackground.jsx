import { cn } from "@/lib/utils"

/**
 * AuthBackground renders the shared immersive backdrop used by
 * the sign-in and sign-up pages, keeping their UI consistent.
 */
const AuthBackground = ({ children, className, contentClassName }) => {
  return (
    <div className={cn("relative min-h-screen w-full overflow-y-auto bg-slate-950 text-slate-100 flex items-start sm:items-center justify-center py-3 sm:py-4 md:py-6 lg:py-8", className)}>
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.95),rgba(2,6,23,0.95))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_50%),radial-gradient(circle_at_80%_0%,rgba(251,191,36,0.18),transparent_40%),radial-gradient(circle_at_10%_80%,rgba(127,29,29,0.35),transparent_55%)] opacity-70 mix-blend-screen" />
        <div className="absolute inset-0 opacity-15 bg-[linear-gradient(120deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:160px_160px]" />
        <div className="absolute -top-44 -right-24 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-wildcats-yellow/50 via-wildcats-maroon/45 to-transparent blur-3xl opacity-80 animate-[pulse_10s_ease-in-out_infinite]" />
        <div className="absolute -bottom-56 -left-32 h-[36rem] w-[36rem] rounded-full bg-gradient-to-tr from-wildcats-maroon/60 via-rose-600/45 to-transparent blur-[150px] opacity-70 animate-[pulse_14s_ease-in-out_infinite]" />
      </div>

      <div className={cn("relative z-10 w-full flex items-center justify-center min-h-0", contentClassName)}>
        {children}
      </div>
    </div>
  )
}

export default AuthBackground


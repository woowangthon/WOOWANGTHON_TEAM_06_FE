import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

const Ctx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('')
  const notify = useCallback((m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg((cur) => (cur === m ? '' : cur)), 3200)
  }, [])
  return (
    <Ctx.Provider value={notify}>
      {children}
      <div className="toast" role="status" aria-live="polite">{msg && <span>{msg}</span>}</div>
    </Ctx.Provider>
  )
}

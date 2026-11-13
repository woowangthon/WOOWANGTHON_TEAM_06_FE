import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Renders its children into the sidebar's slot, so each page can put its own controls on the left. */
export default function SideSlot({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => { setEl(document.getElementById('side-slot')) }, [])
  return el ? createPortal(children, el) : null
}

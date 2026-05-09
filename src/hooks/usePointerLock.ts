import { useEffect } from 'react'

export function usePointerLock(
  ref: React.RefObject<HTMLElement>,
  onMove: (dx: number, dy: number) => void,
) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onClick = () => el.requestPointerLock()
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === el) {
        onMove(e.movementX, e.movementY)
      }
    }

    el.addEventListener('click', onClick)
    document.addEventListener('mousemove', onMouseMove)
    return () => {
      el.removeEventListener('click', onClick)
      document.removeEventListener('mousemove', onMouseMove)
    }
  }, [ref, onMove])
}

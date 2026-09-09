import { useContext } from 'react'
import { TraceroContext, type TraceroContextType } from './tracero-context'

export function useTracero(): TraceroContextType {
  const context = useContext(TraceroContext)
  if (!context) {
    throw new Error('useTracero must be used within TraceroProvider')
  }
  return context
}

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { IRecurrence } from '@/types'

export function useRecurrences() {
  const [recurrences, setRecurrences] = useState<IRecurrence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchRecurrences = async () => {
    try {
      const res = await api.get('/recurrences')
      setRecurrences(res.data)
    } catch {
      setError('Erro ao carregar recorrências')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecurrences()
  }, [])

  return { recurrences, loading, error, refetch: fetchRecurrences }
}
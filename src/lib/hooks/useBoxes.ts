import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { IBoxesResponse } from '@/types'

const EMPTY: IBoxesResponse = { boxes: [], entries: [], inAccounts: 0, inBoxes: 0, free: 0 }

export function useBoxes() {
  const [data, setData] = useState<IBoxesResponse>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchBoxes = async () => {
    try {
      const res = await api.get('/boxes')
      setData(res.data)
    } catch {
      setError('Erro ao carregar caixinhas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBoxes()
  }, [])

  return { ...data, loading, error, refetch: fetchBoxes }
}

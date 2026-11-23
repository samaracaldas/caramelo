import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { IClient } from '@/types'

export function useClients() {
  const [clients, setClients] = useState<IClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchClients = async () => {
    try {
      const res = await api.get('/clients')
      setClients(res.data)
    } catch {
      setError('Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  return { clients, loading, error, refetch: fetchClients }
}
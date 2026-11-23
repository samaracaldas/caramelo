import axios from 'axios'

// A API está no mesmo domínio (route handlers do Next em /api).
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15_000,
})

export function getErrorMessage(err: unknown, fallback = 'Algo deu errado. Tente de novo.') {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message
    if (message) return message
    if (err.code === 'ECONNABORTED') return 'O servidor demorou para responder. Tente de novo.'
    if (!err.response || err.response.status >= 500) return 'Servidor indisponível no momento. Tente de novo em instantes.'
  }
  return fallback
}

export default api

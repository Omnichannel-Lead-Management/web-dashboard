export function normalizeTelegramToken(value) {
  const token = String(value ?? '').trim()
  if (!token) return { token: '', error: 'Enter a Telegram bot token' }
  if (/\s/.test(token)) {
    return {
      token: '',
      error: 'Telegram bot tokens cannot contain spaces or line breaks',
    }
  }
  return { token, error: '' }
}

export function telegramSecretReset() {
  return { token: '', showToken: false }
}

export function isTelegramRequestCurrent(
  requestGeneration,
  activeGeneration,
  requestBusinessId,
  activeBusinessId,
  active = true,
) {
  return (
    active &&
    requestGeneration === activeGeneration &&
    requestBusinessId === activeBusinessId
  )
}

export function telegramSafeErrorMessage(error, token) {
  const message = String(error?.message || 'Telegram connection failed')
  return token ? message.split(token).join('[redacted]') : message
}

export async function refreshTelegramBusinessBestEffort(refreshBusiness) {
  try {
    await refreshBusiness()
    return true
  } catch {
    return false
  }
}

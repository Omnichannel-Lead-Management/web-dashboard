export function isWhatsAppRequestCurrent(
  requestGeneration,
  activeGeneration,
  requestBusinessId,
  activeBusinessId,
  mounted = true,
) {
  return (
    mounted &&
    requestGeneration === activeGeneration &&
    requestBusinessId === activeBusinessId
  )
}

export function shouldPollWhatsApp(state, mounted = true) {
  return mounted && state === 'awaiting-scan'
}

/** Refresh secondary business metadata without downgrading live connection state. */
export async function refreshWhatsAppBusinessBestEffort(refreshBusiness) {
  try {
    await refreshBusiness()
    return true
  } catch {
    return false
  }
}

/**
 * Resolve initialization from the authoritative live status. The business row
 * contributes display metadata only; its whatsapp_connected flag is not a
 * connection-state signal because the gateway derives it from instanceName.
 */
export function resolveWhatsAppInitialState(
  business = {},
  liveStatus = {},
  statusError = null,
) {
  return {
    state: statusError ? 'error' : liveStatus.connected ? 'connected' : 'idle',
    instanceName: String(
      liveStatus?.instanceName || business?.whatsapp_instance_name || '',
    ),
  }
}

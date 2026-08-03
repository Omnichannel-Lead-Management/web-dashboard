export function isOnboardingChannelConfirmed({
  business,
  businessId,
  channelConfirmedThisSession = false,
} = {}) {
  if (!businessId || business?.id !== businessId) return false

  return Boolean(
    business.telegram_connected === true ||
    business.whatsapp_connected === true ||
    channelConfirmedThisSession,
  )
}

export function isCurrentTemplateAttachment({
  requestBusinessId,
  activeBusinessId,
  flow,
} = {}) {
  return Boolean(
    flow &&
    requestBusinessId &&
    requestBusinessId === activeBusinessId &&
    (!flow.businessId || flow.businessId === requestBusinessId),
  )
}

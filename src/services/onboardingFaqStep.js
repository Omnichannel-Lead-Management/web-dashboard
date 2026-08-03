export function hasConfirmedFaqForBusiness(faqs, businessId) {
  return Boolean(
    businessId &&
    Array.isArray(faqs) &&
    faqs.some((faq) => faq?.businessId === businessId),
  )
}

export function createOnboardingFaqStepLoader(store) {
  let generation = 0
  let loadedBusinessId = ''
  let pendingBusinessId = ''

  async function enter(businessId) {
    if (!businessId || businessId !== store.businessId)
      return { status: 'stale' }
    if (loadedBusinessId === businessId) {
      return { status: 'loaded', businessId, faqs: store.faqs }
    }
    if (pendingBusinessId === businessId) return { status: 'pending' }

    const requestGeneration = ++generation
    pendingBusinessId = businessId
    try {
      const faqs = await store.refreshFaqs()
      if (
        requestGeneration !== generation ||
        businessId !== store.businessId ||
        faqs === null
      ) {
        return { status: 'stale' }
      }
      loadedBusinessId = businessId
      return { status: 'loaded', businessId, faqs }
    } catch (error) {
      if (requestGeneration !== generation || businessId !== store.businessId) {
        return { status: 'stale' }
      }
      return { status: 'failed', businessId, error }
    } finally {
      if (requestGeneration === generation) pendingBusinessId = ''
    }
  }

  function invalidate() {
    generation += 1
    loadedBusinessId = ''
    pendingBusinessId = ''
  }

  return { enter, invalidate }
}

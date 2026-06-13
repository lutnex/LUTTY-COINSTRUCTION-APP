import { useState, useCallback, useEffect } from 'react'
import {
  getStoredLogo, saveLogo, clearStoredLogo, getDefaultLogoDataUrl,
  readLogoFile, resolveLogoUrl,
} from '../utils/logoStore.js'

export function useCompanyLogo() {
  const [logoUrl, setLogoUrl] = useState(() => resolveLogoUrl())
  const [isCustom, setIsCustom] = useState(() => Boolean(getStoredLogo()))

  useEffect(() => {
    setLogoUrl(resolveLogoUrl())
    setIsCustom(Boolean(getStoredLogo()))
  }, [])

  const uploadLogo = useCallback(async (file) => {
    const dataUrl = await readLogoFile(file)
    saveLogo(dataUrl)
    setLogoUrl(dataUrl)
    setIsCustom(true)
    return dataUrl
  }, [])

  const resetLogo = useCallback(() => {
    clearStoredLogo()
    const def = getDefaultLogoDataUrl()
    setLogoUrl(def)
    setIsCustom(false)
  }, [])

  const refresh = useCallback(() => {
    setLogoUrl(resolveLogoUrl())
    setIsCustom(Boolean(getStoredLogo()))
  }, [])

  return {
    logoUrl,
    isCustom,
    uploadLogo,
    resetLogo,
    refresh,
    getExportLogo: resolveLogoUrl,
  }
}

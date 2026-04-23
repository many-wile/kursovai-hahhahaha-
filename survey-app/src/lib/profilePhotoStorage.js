const PROFILE_PHOTOS_KEY = 'survey_app_profile_photos'
const LEGACY_PROFILE_PHOTO_KEY = 'survey_app_profile_photo'
const GUEST_PROFILE_KEY = 'guest'
export const PROFILE_PHOTO_EVENT = 'survey_app_profile_photo_updated'

function loadAllProfilePhotos() {
  try {
    const raw = localStorage.getItem(PROFILE_PHOTOS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveAllProfilePhotos(map) {
  localStorage.setItem(PROFILE_PHOTOS_KEY, JSON.stringify(map))
}

function normalizeString(value) {
  if (value == null) {
    return ''
  }

  return String(value).trim().toLowerCase()
}

export function resolveProfileOwnerKey(owner) {
  if (!owner) {
    return GUEST_PROFILE_KEY
  }

  if (typeof owner === 'string') {
    const normalized = normalizeString(owner)
    return normalized ? `key:${normalized}` : GUEST_PROFILE_KEY
  }

  const id =
    normalizeString(owner.id) ||
    normalizeString(owner.Id) ||
    normalizeString(owner.userId) ||
    normalizeString(owner.UserId) ||
    normalizeString(owner.sub) ||
    normalizeString(owner.Sub)

  if (id) {
    return `id:${id}`
  }

  const email = normalizeString(owner.email) || normalizeString(owner.Email)
  if (email) {
    return `email:${email}`
  }

  const userName =
    normalizeString(owner.userName) ||
    normalizeString(owner.UserName) ||
    normalizeString(owner.username) ||
    normalizeString(owner.login)

  if (userName) {
    return `user:${userName}`
  }

  return GUEST_PROFILE_KEY
}

function migrateLegacyPhoto(ownerKey, map) {
  const legacyPhoto = localStorage.getItem(LEGACY_PROFILE_PHOTO_KEY) || ''
  if (!legacyPhoto || !ownerKey || ownerKey === GUEST_PROFILE_KEY) {
    return map[ownerKey] || ''
  }

  if (!map[ownerKey]) {
    map[ownerKey] = legacyPhoto
    saveAllProfilePhotos(map)
  }

  localStorage.removeItem(LEGACY_PROFILE_PHOTO_KEY)
  return map[ownerKey] || ''
}

export function getStoredProfilePhoto(owner = null) {
  const ownerKey = resolveProfileOwnerKey(owner)
  const map = loadAllProfilePhotos()
  return map[ownerKey] || migrateLegacyPhoto(ownerKey, map) || ''
}

function emitProfilePhotoChange(ownerKey) {
  window.dispatchEvent(
    new CustomEvent(PROFILE_PHOTO_EVENT, {
      detail: { ownerKey },
    }),
  )
}

export function saveStoredProfilePhoto(dataUrl, owner = null) {
  const ownerKey = resolveProfileOwnerKey(owner)
  const map = loadAllProfilePhotos()

  if (!dataUrl || ownerKey === GUEST_PROFILE_KEY) {
    delete map[ownerKey]
  } else {
    map[ownerKey] = dataUrl
  }

  saveAllProfilePhotos(map)
  emitProfilePhotoChange(ownerKey)
}

export function clearStoredProfilePhoto(owner = null) {
  const ownerKey = resolveProfileOwnerKey(owner)
  const map = loadAllProfilePhotos()

  delete map[ownerKey]
  saveAllProfilePhotos(map)
  emitProfilePhotoChange(ownerKey)
}


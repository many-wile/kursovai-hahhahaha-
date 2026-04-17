const PROFILE_PHOTO_KEY = 'survey_app_profile_photo'
export const PROFILE_PHOTO_EVENT = 'survey_app_profile_photo_updated'

export function getStoredProfilePhoto() {
  return localStorage.getItem(PROFILE_PHOTO_KEY) || ''
}

function emitProfilePhotoChange() {
  window.dispatchEvent(new CustomEvent(PROFILE_PHOTO_EVENT))
}

export function saveStoredProfilePhoto(dataUrl) {
  if (!dataUrl) {
    localStorage.removeItem(PROFILE_PHOTO_KEY)
  } else {
    localStorage.setItem(PROFILE_PHOTO_KEY, dataUrl)
  }

  emitProfilePhotoChange()
}

export function clearStoredProfilePhoto() {
  localStorage.removeItem(PROFILE_PHOTO_KEY)
  emitProfilePhotoChange()
}

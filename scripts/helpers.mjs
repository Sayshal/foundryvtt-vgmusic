import { CONST } from './config.mjs';

/**
 * Utility helper functions
 */

/**
 * Get the first available GM user
 * @returns {User|null} First active GM user
 */
export function getFirstAvailableGM() {
  return game.users.filter((user) => user.isGM && user.active).sort((a, b) => a.id.localeCompare(b.id))[0] || null;
}

/**
 * Check if current user is the head GM
 * @returns {boolean} True if current user is head GM
 */
export function isHeadGM() {
  return game.user === getFirstAvailableGM();
}

/**
 * Get property from object using dot notation
 * @param {Object} object - Source object
 * @param {string} path - Dot notation path
 * @returns {*} Property value
 */
export function getProperty(object, path) {
  return foundry.utils.getProperty(object, path);
}

/**
 * Set property on object using dot notation
 * @param {Object} object - Target object
 * @param {string} path - Dot notation path
 * @param {*} value - Value to set
 */
export function setProperty(object, path, value) {
  return foundry.utils.setProperty(object, path, value);
}

/**
 * Playlist context class for managing music contexts
 */
export class PlaylistContext {
  constructor(context, contextEntity, playlist, trackId, priority = 0, scopeEntity = null) {
    this.context = context;
    this.contextEntity = contextEntity;
    this.playlist = playlist;
    this.trackId = trackId;
    this.priority = priority;
    this.scopeEntity = scopeEntity;
  }

  get track() {
    return this.playlist?.sounds.get(this.trackId);
  }

  /**
   * Create playlist context from document
   * @param {Document} document - Source document
   * @param {string} type - Music type ('area' or 'combat')
   * @param {Document} scopeEntity - Scope entity for progress tracking
   * @returns {PlaylistContext|null} Created context or null
   */
  static fromDocument(document, type = 'combat', scopeEntity = null) {
    if (document instanceof foundry.abstract.Document) {
      const playlistId = document.getFlag(CONST.moduleId, `music.${type}.playlist`);
      const playlist = playlistId ? game.playlists.get(playlistId) : null;
      if (!playlist) return null;
      const trackId = document.getFlag(CONST.moduleId, `music.${type}.initialTrack`) || null;
      const priority = document.getFlag(CONST.moduleId, `music.${type}.priority`) ?? 0;
      return new this(type, document, playlist, trackId, priority, scopeEntity);
    }
    if (document.documentName === 'DefaultMusic') {
      const section = document.data?.vgmusic?.music?.[type];
      if (!section) return null;
      const playlistId = section.playlist;
      const playlist = playlistId ? game.playlists.get(playlistId) : null;
      if (!playlist) return null;
      const trackId = section.initialTrack || null;
      const priority = section.priority ?? 0;
      return new this(type, document, playlist, trackId, priority, scopeEntity);
    }
    return null;
  }
}

/**
 * Fading track handler for smooth transitions
 */
export class FadingTrack {
  constructor(track, fadeDuration = 1000) {
    this.track = track;
    this.fadeDuration = fadeDuration;
    setTimeout(() => this.delete(), this.fadeDuration + 10);
  }
  delete() {
    const controller = game.vgmusic?.musicController;
    if (!controller) return;
    const index = controller.fadingTracks.indexOf(this);
    if (index >= 0) {
      controller.fadingTracks.splice(index, 1);
      if (controller.currentTrack === this.track) controller.playCurrentTrack();
    }
  }
}

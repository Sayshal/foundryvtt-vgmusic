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
 * Get property from object using dot notation, with migration fallback
 * @param {Object} object - Source object
 * @param {string} path - Dot notation path
 * @returns {*} Property value
 */
export function getProperty(object, path) {
  const result = foundry.utils.getProperty(object, path);
  if (result !== undefined) return result;
  if (path.includes('flags.foundryvtt-vgmusic')) {
    const oldPath = path.replace('flags.foundryvtt-vgmusic', 'flags.vgmusic');
    const oldResult = foundry.utils.getProperty(object, oldPath);
    if (oldResult !== undefined) {
      console.log(`VGMusic | Found data in old location for "${path}", migration needed`);
      return oldResult;
    }
  }
  return result;
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

  /**
   * Start the fade operation
   */
  async startFade() {
    if (!this.track) {
      this.delete();
      return;
    }
    try {
      if (this.direction === 'out') await this.fadeOut();
      else if (this.direction === 'in') await this.fadeIn();
    } catch (error) {
      console.error('FadingTrack | Error during fade:', error);
      if (this.direction === 'out') await this.track.update({ playing: false, pausedTime: null });
    }
    this.delete();
  }

  /**
   * Perform fade out operation
   */
  async fadeOut() {
    if (!this.track.playing) return;
    const startVolume = this.track.volume;
    const steps = 20;
    const stepDuration = this.fadeDuration / steps;
    const volumeStep = startVolume / steps;
    for (let i = 0; i < steps; i++) {
      const newVolume = Math.max(0, startVolume - volumeStep * (i + 1));
      await this.track.update({ volume: newVolume });
      await new Promise((resolve) => setTimeout(resolve, stepDuration));
    }
    await this.track.update({ playing: false, pausedTime: null, volume: startVolume });
  }

  /**
   * Perform fade in operation
   */
  async fadeIn() {
    const steps = 20; // Number of volume steps
    const stepDuration = this.fadeDuration / steps;
    const volumeStep = this.targetVolume / steps;
    await this.track.update({ volume: 0 });
    for (let i = 0; i < steps; i++) {
      const newVolume = Math.min(this.targetVolume, volumeStep * (i + 1));
      await this.track.update({ volume: newVolume });
      await new Promise((resolve) => setTimeout(resolve, stepDuration));
    }
  }

  /**
   * Remove this fading track from the controller
   */
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

/**
 * Migrate old VGMusic flag data from 'vgmusic' to 'foundryvtt-vgmusic'
 * @param {Document} document - Document to migrate
 * @returns {boolean} True if migration was performed
 */
export async function migrateVGMusicFlags(document) {
  try {
    const oldFlags = document.flags?.vgmusic;
    const newFlags = document.flags?.[CONST.moduleId];
    if (!oldFlags || newFlags) return false;
    console.log(`VGMusic | Migrating flags for ${document.documentName} "${document.name}"`);
    console.log('Old data:', oldFlags);
    await document.setFlag(CONST.moduleId, 'music', oldFlags.music);
    if (oldFlags.playlist) await document.setFlag(CONST.moduleId, 'playlist', oldFlags.playlist);
    await document.unsetFlag('vgmusic');
    console.log(`VGMusic | Successfully migrated flags for "${document.name}"`);
    return true;
  } catch (error) {
    console.error(`VGMusic | Error migrating flags for "${document.name}":`, error);
    return false;
  }
}

/**
 * Migrate all documents in the world
 */
export async function migrateAllVGMusicFlags() {
  console.log('VGMusic | Starting world migration...');
  let migratedCount = 0;
  for (const scene of game.scenes) if (await migrateVGMusicFlags(scene)) migratedCount++;
  for (const actor of game.actors) if (await migrateVGMusicFlags(actor)) migratedCount++;
  const oldSettingKey = 'vgmusic.defaultMusic';
  if (game.settings.settings.has(oldSettingKey)) {
    try {
      const oldDefaultMusic = game.settings.get('vgmusic', 'defaultMusic');
      if (oldDefaultMusic) {
        await game.settings.set(CONST.moduleId, CONST.settings.defaultMusic, oldDefaultMusic);
        console.log('VGMusic | Migrated default music settings');
        migratedCount++;
      }
    } catch (error) {
      console.warn('VGMusic | Could not migrate old default music settings:', error);
    }
  }

  if (migratedCount > 0) ui.notifications.info(`VGMusic | Migrated ${migratedCount} documents from old format`);
  return migratedCount;
}

/**
 * Check if document has old format data that needs migration
 * @param {Document} document - Document to check
 * @returns {boolean} True if migration is needed
 */
export function needsMigration(document) {
  const oldFlags = document.flags?.vgmusic;
  const newFlags = document.flags?.[CONST.moduleId];
  return !!(oldFlags && !newFlags);
}

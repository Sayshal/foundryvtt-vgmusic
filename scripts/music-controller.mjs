import { CONST } from './config.mjs';
import { PlaylistContext, FadingTrack, isHeadGM } from './helpers.mjs';

/**
 * Core music controller for managing playlist playback
 */
export class MusicController {
  constructor() {
    this.currentContext = null;
    this.fadingTracks = [];
  }

  get currentCombat() {
    return game.combats.find((combat) => combat.scene === this.currentScene);
  }

  get currentScene() {
    return game.scenes.find((scene) => scene.active);
  }

  get currentTrack() {
    return this.currentContext?.track;
  }

  get currentTrackInfo() {
    if (!this.currentTrack) return {};
    const track = this.currentTrack;
    return this.currentContext?.scopeEntity?.getFlag(CONST.moduleId, `playlist.${track.parent.id}.${track.id}`);
  }

  /**
   * Get all current playlist contexts
   * @returns {PlaylistContext[]} Array of playlist contexts
   */
  getAllCurrentPlaylists() {
    const contexts = [];
    const scene = this.currentScene;
    const combat = this.currentCombat;

    // Scene area music
    if (scene) {
      const ctx = PlaylistContext.fromDocument(scene, 'area', scene);
      if (ctx) contexts.push(ctx);
    }

    // Scene combat music
    if (scene) {
      const ctx = PlaylistContext.fromDocument(scene, 'combat', combat);
      if (ctx) contexts.push(ctx);
    }

    // Actor combat music
    if (combat) {
      for (const combatant of combat.combatants) {
        const ctx = PlaylistContext.fromDocument(combatant.actor, 'combat', combat);
        if (ctx) contexts.push(ctx);
      }
    }

    // Default combat music
    if (combat) {
      const defaultConfig = game.settings.get(CONST.moduleId, CONST.settings.defaultMusic);
      if (defaultConfig) {
        const ctx = PlaylistContext.fromDocument(defaultConfig, 'combat', combat);
        if (ctx) contexts.push(ctx);
      }
    }

    return contexts;
  }

  /**
   * Filter playlist contexts based on current state
   * @param {PlaylistContext} context - Context to filter
   * @returns {boolean} True if context should be included
   */
  filterPlaylists(context) {
    const combat = this.currentCombat;

    // Remove combat tracks without active combat
    if (context.context === 'combat' && !combat?.started) return false;

    // Remove suppressed tracks
    if (context.context === 'combat' && game.settings.get(CONST.moduleId, CONST.settings.suppressCombat)) return false;
    if (context.context === 'area' && game.settings.get(CONST.moduleId, CONST.settings.suppressArea)) return false;

    return true;
  }

  /**
   * Sort playlist contexts by priority
   * @param {PlaylistContext} a - First context
   * @param {PlaylistContext} b - Second context
   * @returns {number} Sort comparison result
   */
  sortPlaylists(a, b) {
    const combat = this.currentCombat;
    const currentActor = combat?.combatant?.actor;

    // Prioritize current combatant
    if (a.contextEntity === currentActor) return -1;
    if (b.contextEntity === currentActor) return 1;

    const silentMode = game.settings.get(CONST.moduleId, CONST.settings.silentCombatMusicMode);

    // Handle different silent modes
    if (silentMode === CONST.silentModes.lastActor) {
      const combatants = combat?.turns || [];
      const startIdx = combat?.current?.turn || 0;

      if (startIdx >= 0 && combatants.length > 0) {
        let i = startIdx;
        do {
          i = (i - 1 + combatants.length) % combatants.length;
          const actor = combatants[i]?.actor;
          if (a.contextEntity === actor) return -1;
          if (b.contextEntity === actor) return 1;
        } while (i !== (startIdx + 1) % combatants.length);
      }
    } else if (silentMode === CONST.silentModes.area) {
      if (a.contextEntity.documentName !== 'Actor' && a.context === 'area') return -1;
      if (b.contextEntity.documentName !== 'Actor' && b.context === 'area') return 1;
    } else if (silentMode === CONST.silentModes.generic) {
      if (a.contextEntity.documentName !== 'Actor' && a.context === 'combat') return -1;
      if (b.contextEntity.documentName !== 'Actor' && b.context === 'combat') return 1;
    }

    // Sort by priority
    if (a.priority !== b.priority) return b.priority - a.priority;

    // Sort by document type
    if (a.contextEntity.documentName !== b.contextEntity.documentName) {
      const priorities = CONST.documentSortPriority;
      return priorities.indexOf(b.contextEntity.documentName) - priorities.indexOf(a.contextEntity.documentName);
    }

    return 0;
  }

  /**
   * Get the current highest priority playlist context
   * @returns {PlaylistContext|null} Current context or null
   */
  getCurrentPlaylist() {
    const contexts = this.getAllCurrentPlaylists().filter(this.filterPlaylists.bind(this)).sort(this.sortPlaylists.bind(this));

    return contexts.length > 0 ? contexts[0] : null;
  }

  /**
   * Play the current track based on context
   */
  async playCurrentTrack() {
    if (!isHeadGM()) return;

    const newContext = this.getCurrentPlaylist();
    await this.playMusic(newContext);
  }

  /**
   * Get playlist data for a track
   * @param {Document} entity - Entity to get data from
   * @param {string} playlistId - Playlist ID
   * @param {string} trackId - Track ID
   * @returns {Object} Playlist data
   */
  getPlaylistData(entity, playlistId, trackId) {
    const data = entity.getFlag(CONST.moduleId, `playlist.${playlistId}.${trackId}`);
    return (
      data || {
        id: playlistId,
        trackId,
        start: 0
      }
    );
  }

  /**
   * Save current playlist data
   * @param {Document} entity - Entity to save data to
   */
  async savePlaylistData(entity) {
    if (entity instanceof Combat && !game.combats.get(entity.id)) return;
    if (!this.currentTrack || !entity || !isHeadGM()) return;

    const track = this.currentTrack;
    await entity.setFlag(CONST.moduleId, `playlist.${track.parent.id}.${track.id}`, {
      id: track.parent.id,
      trackId: track.id,
      start: (track.sound?.currentTime ?? 0) % (track.sound?.duration ?? 100)
    });
  }

  /**
   * Play music for a given context
   * @param {PlaylistContext|null} context - Playlist context to play
   */
  async playMusic(context) {
    const prevTrack = this.currentTrack;
    const newTrack = context?.track;

    const isFading = {
      prev: this.fadingTracks.some((ft) => ft.track === prevTrack),
      new: this.fadingTracks.some((ft) => ft.track === newTrack)
    };

    // Handle previous track
    if (prevTrack !== newTrack && prevTrack) {
      await this.savePlaylistData(this.currentContext?.scopeEntity);
      await prevTrack.update({ playing: false, pausedTime: null });

      if (prevTrack.fadeDuration > 0 && !isFading.prev) {
        this.fadingTracks.push(new FadingTrack(prevTrack, prevTrack.fadeDuration));
      }

      this.currentContext = null;
    }

    // Handle new track
    if (newTrack) {
      this.currentContext = context;
      if (!isFading.new) {
        const startTime = this.currentTrackInfo?.start ?? 0;
        await newTrack.update({ playing: true, pausedTime: startTime });
      }
    }
  }
}

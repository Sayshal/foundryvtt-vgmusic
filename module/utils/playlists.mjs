export class PlaylistContext {
  /**
   * @constructor
   * @param {string} context - The context for this descriptor. Either "area" or "combat" by default.
   * @param {object} contextEntity - A document (Actor, Scene, etc.)
   * @param {Playlist} playlist - The playlist to play for this context.
   * @param {string} trackId - The track ID to start at with this context.
   * @param {number} [priority=null] - The priority for this context. Plays higher priority contexts first.
   * @param {object} [scopeEntity] - An optional scope entity on which to save progress, such as a scene or combat.
   */
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
   * @param {object} document - A document (Actor, Scene, etc.) to get a playlist context from.
   * @param {string} [type="combat"] - The type of music to get. "area" and "combat" are supported by default.
   * @returns {PlaylistContext|null} The context, or null if no playlist was found.
   */
  static fromDocument(document, type = 'combat', scopeEntity = null) {
    // Handle Document
    if (document instanceof foundry.abstract.Document) {
      const playlistId = document.getFlag('vgmusic', `music.${type}.playlist`);
      const playlist = playlistId ? game.playlists.get(playlistId) : null;
      if (!playlist) return null;

      const trackId = document.getFlag('vgmusic', `music.${type}.initialTrack`) || null;
      const priority = document.getFlag('vgmusic', `music.${type}.priority`) ?? 0;

      return new this(type, document, playlist, trackId, priority, scopeEntity);
    }

    // Handle something else
    else {
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
    }
  }
}

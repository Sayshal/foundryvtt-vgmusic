export const MusicController = {
  context: null,
  _fadingTracks: [],

  get currentCombat() {
    return game.combats.find((o) => o.scene === this.currentScene);
  },
  get currentScene() {
    return game.scenes.find((o) => o.active);
  },

  get track() {
    return this.context?.track;
  },
  get currentTrackInfo() {
    if (!this.track) return {};
    return this.context?.scopeEntity?.getFlag('vgmusic', `playlist.${this.track.parent.id}.${this.track.id}`);
  },

  get documentNameSortPriority() {
    return ['Actor', 'Scene', 'DefaultMusic'];
  },

  getAllCurrentPlaylists() {
    let result = [];

    // Get scene area playlist
    const scene = this.currentScene;
    if (scene != null) {
      const ctx = vgmusic.utils.PlaylistContext.fromDocument(scene, 'area', scene);
      if (ctx) result.push(ctx);
    }

    // Get combat playlists
    const combat = this.currentCombat;
    if (scene != null) {
      const ctx = vgmusic.utils.PlaylistContext.fromDocument(scene, 'combat', combat);
      if (ctx) result.push(ctx);
    }

    // Get actor combat playlists
    if (combat != null) {
      for (const combatant of combat.combatants) {
        const ctx = vgmusic.utils.PlaylistContext.fromDocument(combatant.actor, 'combat', combat);
        if (ctx) result.push(ctx);
      }
    }

    // Get default combat playlist
    if (combat != null) {
      const defaultMusicConfig = game.settings.get('vgmusic', 'defaultMusic');
      if (defaultMusicConfig != null) {
        const ctx = vgmusic.utils.PlaylistContext.fromDocument(defaultMusicConfig, 'combat', combat);
        if (ctx) result.push(ctx);
      }
    }

    return result;
  },

  filterPlaylists(ctx) {
    const combat = this.currentCombat;
    // Remove combat track without combat
    if (ctx.context === 'combat' && !combat?.started) return false;
    // Remove combat track with combat music supressed
    if (ctx.context === 'combat' && game.settings.get('vgmusic', 'supress.combat') === true) return false;

    // Remove area track with area music supressed
    if (ctx.context === 'area' && game.settings.get('vgmusic', 'supress.area') === true) return false;

    return true;
  },

  sortPlaylists(a, b) {
    // Sort by current combatant
    const combat = this.currentCombat;
    const currentActor = combat?.combatant.actor;
    // Immediately return current combatant's playlist
    if (a.contextEntity === currentActor) return -1;
    if (b.contextEntity === currentActor) return 1;

    // Sort to make sure last actor's combat music will be playing
    const silentMode = game.settings.get('vgmusic', 'silentCombatMusicMode');
    if (silentMode === 'lastActor') {
      const combatants = combat.turns;
      const startIdx = combat.current.turn;
      if (startIdx >= 0 && combatants.length > 0) {
        let i = startIdx;
        while (i !== (startIdx + 1) % combatants.length) {
          i--;
          if (i < 0) i += combatants.length;

          const actor = combatants[i].actor;
          if (a.contextEntity === actor) return -1;
          if (b.contextEntity === actor) return 1;
        }
      }
    } else if (silentMode === 'area') {
      if (a.contextEntity.documentName !== 'Actor' && a.context === 'area') return -1;
      if (b.contextEntity.documentName !== 'Actor' && b.context === 'area') return 1;
    } else if (silentMode === 'generic') {
      if (a.contextEntity.documentName !== 'Actor' && a.context === 'combat') return -1;
      if (b.contextEntity.documentName !== 'Actor' && b.context === 'combat') return 1;
    }

    // Sort by priority
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.contextEntity.documentName !== b.contextEntity.documentName) {
      const arr = this.documentNameSortPriority;
      return arr.indexOf(b.contextEntity.documentName) - arr.indexOf(a.contextEntity.documentName);
    }
    return 0;
  },

  getCurrentPlaylist() {
    const playlists = this.getAllCurrentPlaylists().filter(this.filterPlaylists.bind(this)).sort(this.sortPlaylists.bind(this));
    if (playlists.length > 0) return playlists[0];

    return null;
  },

  async playCurrentTrack() {
    if (!vgmusic.utils.isHeadGM()) return;

    const newContext = this.getCurrentPlaylist();

    // Switch music
    await this.playMusic(newContext);
  },

  getPlaylistData(entity, playlistId, trackId) {
    const playlistData = entity.getFlag('vgmusic', `playlist.${playlistId}.${trackId}`);
    if (!playlistData) {
      return {
        id: playlistId,
        trackId,
        start: 0
      };
    }
    return playlistData;
  },

  savePlaylistData(entity) {
    if (entity instanceof Combat && game.combats.get(entity.id) == null) return;

    const track = this.track;
    if (track == null || entity == null) return;

    if (vgmusic.utils.isHeadGM()) {
      return entity.setFlag('vgmusic', `playlist.${track.parent.id}.${track.id}`, {
        id: track.parent.id,
        trackId: track.id,
        start: (track.sound.currentTime ?? 0) % (track.sound.duration ?? 100)
      });
    }
  },

  async playMusic(playlistContext) {
    const prevTrack = this.track;
    const newTrack = playlistContext?.track;
    const fadingTrack = {
      prev: this._fadingTracks.find((o) => o.track === prevTrack) != null,
      new: this._fadingTracks.find((o) => o.track === newTrack) != null
    };

    if (prevTrack !== newTrack && prevTrack != null) {
      await this.savePlaylistData(this.context?.scopeEntity);
      await prevTrack.update({ playing: false, pausedTime: null });
      if (prevTrack.fadeDuration > 0 && !fadingTrack.prev) {
        this._fadingTracks.push(new FadingTrack(prevTrack, prevTrack.fadeDuration));
      }
      this.context = null;
    }

    if (newTrack) {
      this.context = playlistContext;
      if (!fadingTrack.new) {
        await newTrack.update({ playing: true, pausedTime: this.currentTrackInfo?.start ?? 0 });
      }
    }
  }
};

export class FadingTrack {
  constructor(track, fadeDuration) {
    this.track = track;
    this.fadeDuration = fadeDuration || 1000;

    window.setTimeout(this.delete.bind(this), this.fadeDuration + 10);
  }

  get controller() {
    return vgmusic.utils.MusicController;
  }

  delete() {
    const idx = this.controller._fadingTracks.indexOf(this);
    if (idx == null) return;
    this.controller._fadingTracks.splice(idx, 1);

    // Play fading track, if appropriate
    if (this.controller.track === this.track) {
      this.controller.playCurrentTrack();
    }
  }
}

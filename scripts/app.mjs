import { CONST } from './config.mjs';
import { getProperty } from './helpers.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Music configuration application
 */
export class VGMusicConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'vgmusic-config',
    title: 'VGMusic.ConfigTitle',
    classes: ['vgmusic-config'],
    position: { height: 'auto', width: 480, top: 100, left: 200 },
    resizable: true,
    actions: {
      openPlaylist: VGMusicConfig.#openPlaylist,
      deletePlaylist: VGMusicConfig.#deletePlaylist
    },
    window: { icon: 'fas fa-music', resizable: true, minimizable: true },
    dragDrop: [{ dropSelector: '.playlist-section' }]
  };

  static PARTS = { form: { template: 'modules/foundryvtt-vgmusic/templates/music-config.hbs', id: 'vgmusic-config-body' } };

  /**
   * Application constructor
   * @param {Object} object - The document to configure
   * @param {Object} options - Application options
   */
  constructor(object, options = {}) {
    console.log('VGMusicConfig | Constructor called with:', { object, options });
    super(options);
    this.document = object || game.settings.get(CONST.moduleId, CONST.settings.defaultMusic);
    console.log('VGMusicConfig | Document set to:', {
      document: this.document,
      documentName: this.document.documentName,
      documentType: this.document.constructor.name
    });
    if (this.document.apps) {
      this.document.apps[this.appId] = this;
      console.log('VGMusicConfig | Added to document apps');
    }
  }

  get updateDataPrefix() {
    return this.isDocument ? 'flags.foundryvtt-vgmusic' : 'data.vgmusic';
  }

  get isDocument() {
    return this.document instanceof foundry.abstract.Document;
  }

  /**
   * Prepare data for the template context
   * @returns {Promise<Object>} - The template context
   * @protected
   */
  async _prepareContext() {
    console.log('VGMusicConfig | _prepareContext called');
    console.log('VGMusicConfig | Document name for sections lookup:', this.document.documentName);
    try {
      const sections = CONST.playlistSections[this.document.documentName];
      console.log('VGMusicConfig | Found sections:', sections);
      if (!sections) {
        console.warn('VGMusicConfig | No sections found for document type:', this.document.documentName);
        return { playlists: [] };
      }
      console.log('VGMusicConfig | Getting data from prefix:', this.updateDataPrefix);
      const data = getProperty(this.document, this.updateDataPrefix) || {};
      console.log('VGMusicConfig | Retrieved data:', data);
      const playlists = Object.entries(sections).map(([key, config]) => {
        console.log('VGMusicConfig | Processing section:', key, config);
        const playlistId = getProperty(data, `music.${key}.playlist`);
        console.log('VGMusicConfig | Playlist ID for', key, ':', playlistId);
        const playlist = playlistId ? game.playlists.get(playlistId) : null;
        console.log('VGMusicConfig | Found playlist:', playlist?.name || 'none');
        const tracks =
          playlist?.playbackOrder?.map((id) => {
            const track = playlist.sounds.get(id);
            return { id, name: track.name };
          }) || [];
        console.log('VGMusicConfig | Tracks for', key, ':', tracks.length);
        const sectionData = getProperty(data, `music.${key}`) || {};
        console.log('VGMusicConfig | Section data for', key, ':', sectionData);
        return { key, label: game.i18n.localize(config.label), playlist, tracks, data: sectionData, allowPriority: true };
      });
      console.log('VGMusicConfig | Final context prepared:', { playlists });
      return { playlists };
    } catch (error) {
      console.error('VGMusicConfig | Error preparing context:', error);
      return { playlists: [] };
    }
  }

  /**
   * Setup after render
   * @param {Object} context - Application context
   * @param {Object} options - Render options
   * @protected
   */
  _onRender(context, options) {
    console.log('VGMusicConfig | _onRender called with context:', context);
    try {
      console.log('VGMusicConfig | Render setup completed');
    } catch (error) {
      console.error('VGMusicConfig | Error in _onRender:', error);
    }
  }

  /**
   * Clean up when the application is closed
   * @param {Object} options - Closing options
   * @protected
   */
  _onClose(options) {
    if (this.document.apps) delete this.document.apps[this.appId];
    game.vgmusic?.musicController?.playCurrentTrack();
    super._onClose(options);
  }

  async _onDrop(event) {
    event.preventDefault();
    const section = event.currentTarget.dataset.section;
    const data = JSON.parse(event.dataTransfer.getData('text/plain'));
    if (!['Playlist', 'PlaylistSound'].includes(data.type) || !data.uuid) return;
    const document = await fromUuid(data.uuid);
    let playlist, sound;
    if (document instanceof PlaylistSound) {
      playlist = document.parent;
      sound = document;
    } else {
      playlist = document;
    }
    const sectionConfig = CONST.playlistSections[this.document.documentName][section];
    const updateData = {
      [`music.${section}.playlist`]: playlist.id,
      [`music.${section}.initialTrack`]: sound?.id || ''
    };
    const currentData = getProperty(this.document, this.updateDataPrefix) || {};
    const prevData = getProperty(currentData, `music.${section}`);
    if (!prevData?.priority) updateData[`music.${section}.priority`] = sectionConfig.priority;
    await this.updateObject(updateData);
  }

  async updateObject(data) {
    console.log('VGMusicConfig | updateObject called with:', data);
    const expandedData = Object.entries(data).reduce((acc, [key, value]) => {
      acc[`${this.updateDataPrefix}.${key}`] = value;
      return acc;
    }, {});
    console.log('VGMusicConfig | Expanded data:', expandedData);
    if (this.isDocument) {
      console.log('VGMusicConfig | Updating document');
      return this.document.update(expandedData);
    }
    if (this.document.documentName === 'DefaultMusic') {
      console.log('VGMusicConfig | Updating default music settings');
      const prevData = game.settings.get(CONST.moduleId, CONST.settings.defaultMusic);
      const updateData = foundry.utils.mergeObject(prevData, foundry.utils.expandObject(expandedData), {
        inplace: false,
        performDeletions: true
      });
      await game.settings.set(CONST.moduleId, CONST.settings.defaultMusic, updateData);
      this.document = game.settings.get(CONST.moduleId, CONST.settings.defaultMusic);
      return this.render();
    }
  }

  async _processSubmit(event, form, formData) {
    console.log('VGMusicConfig | _processSubmit called with:', formData);
    await this.updateObject(formData.object);
  }

  static async #openPlaylist(event, target) {
    console.log('VGMusicConfig | Open playlist action triggered');
    const playlistId = target.closest('.playlist-section').dataset.itemId;
    const playlist = game.playlists.get(playlistId);
    if (playlist) playlist.sheet.render(true);
  }

  static async #deletePlaylist(event, target) {
    console.log('VGMusicConfig | Delete playlist action triggered');
    const app = target.closest('[data-application-id]');
    const appInstance = ui.windows[app.dataset.applicationId];
    const section = target.closest('.playlist-section').dataset.section;
    await appInstance.updateObject({ [`music.-=${section}`]: null });
  }
}

/**
 * Add scene control buttons for music controls
 */
export function getSceneControlButtons(controls) {
  try {
    if (controls.sounds && controls.sounds.tools) {
      controls.sounds.tools['suppress-area-music'] = {
        name: 'suppress-area-music',
        order: 10,
        title: 'VGMusic.Controls.SuppressAreaMusic',
        icon: 'fas fa-dungeon',
        toggle: true,
        visible: true,
        active: game.settings.get(CONST.moduleId, CONST.settings.suppressArea),
        onChange: (event, active) => {
          game.settings.set(CONST.moduleId, CONST.settings.suppressArea, active);
        }
      };
      controls.sounds.tools['suppress-combat-music'] = {
        name: 'suppress-combat-music',
        order: 11,
        title: 'VGMusic.Controls.SuppressCombatMusic',
        icon: 'fas fa-fist-raised',
        toggle: true,
        visible: true,
        active: game.settings.get(CONST.moduleId, CONST.settings.suppressCombat),
        onChange: (event, active) => {
          game.settings.set(CONST.moduleId, CONST.settings.suppressCombat, active);
        }
      };
    }
  } catch (error) {
    console.error('VGMusic | Error adding scene control buttons:', error);
  }
}

/**
 * Add header controls to actor sheets
 */
export function getActorSheetHeaderControls(sheet, buttons) {
  console.log('VGMusic | getActorSheetHeaderControls called', {
    sheet: sheet?.constructor?.name,
    isGM: game.user.isGM,
    buttonsLength: buttons?.length
  });

  try {
    if (!game.user.isGM) {
      console.log('VGMusic | Not GM, skipping header control');
      return;
    }
    console.log('VGMusic | Adding music button to header controls');
    const clickHandler = (event) => {
      console.log('VGMusic | Music button clicked!', { event, sheet });
      try {
        event.preventDefault();
        console.log('VGMusic | Creating VGMusicConfig with actor:', sheet.document);
        const config = new VGMusicConfig(sheet.document);
        console.log('VGMusic | VGMusicConfig created:', config);
        config.render(true);
        console.log('VGMusicConfig | VGMusicConfig render called');
      } catch (error) {
        console.error('VGMusic | Error in onclick handler:', error);
      }
    };

    const musicButton = {
      label: game.i18n.localize('VGMusic.CombatMusic'),
      class: 'configure-combat-music',
      icon: 'fas fa-music',
      onClick: clickHandler
    };
    buttons.unshift(musicButton);
    console.log('VGMusic | Music button added, total buttons:', buttons.length);
    console.log('VGMusic | Button object:', musicButton);
  } catch (error) {
    console.error('VGMusic | Error adding actor sheet header controls:', error);
  }
}

/**
 * Handle scene config rendering
 */
export function handleSceneConfigRender(app, html) {
  try {
    const playlistSelector = html.querySelector('select[name="playlistSound"]');
    if (!playlistSelector) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = 'vgmusic-scene';
    button.innerHTML = `<i class="fas fa-music"></i> ${game.i18n.localize('VGMusic.CombatMusic')}`;
    playlistSelector.parentElement.insertAdjacentElement('afterend', button);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      new VGMusicConfig(app.object).render(true);
    });
  } catch (error) {
    console.error('VGMusic | Error adding scene config button:', error);
  }
}

/**
 * Handle updating combat
 */
export function handleUpdateCombat(combat, updateData) {
  if (combat.started && (updateData.turn != null || updateData.round != null)) game.vgmusic?.musicController?.playCurrentTrack();
}

/**
 * Handle deleting combat
 */
export function handleDeleteCombat() {
  game.vgmusic?.musicController?.playCurrentTrack();
}

/**
 * Handle canvas ready
 */
export function handleCanvasReady() {
  game.vgmusic?.musicController?.playCurrentTrack();
}

/**
 * Handle updating scene
 */
export async function handleUpdateScene(scene, updateData) {
  if ('active' in updateData) {
    if (updateData.active !== true) await scene.unsetFlag(CONST.moduleId, 'playlist');
    game.vgmusic?.musicController?.playCurrentTrack();
  }
}

import { CONST } from './config.mjs';
import { getProperty } from './helpers.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Music configuration application
 */
export class VGMusicConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static PARTS = {
    form: {
      template: 'modules/foundryvtt-vgmusic/templates/music-config.hbs',
      id: 'vgmusic-config-body'
    }
  };

  static DEFAULT_OPTIONS = {
    id: 'vgmusic-config',
    classes: ['vgmusic-config'],
    title: 'VGMusic.ConfigTitle',
    width: 480,
    height: 360,
    resizable: true,
    actions: {
      openPlaylist: VGMusicConfig.#openPlaylist,
      deletePlaylist: VGMusicConfig.#deletePlaylist
    },
    dragDrop: [{ dropSelector: '.playlist-section' }]
  };

  constructor(object, options = {}) {
    super(options);
    this.document = object || game.settings.get(CONST.moduleId, CONST.settings.defaultMusic);
    if (this.document.apps) this.document.apps[this.appId] = this;
  }

  get title() {
    return game.i18n.localize('VGMusic.ConfigTitle');
  }

  get updateDataPrefix() {
    return this.isDocument ? 'flags.foundryvtt-vgmusic' : 'data.vgmusic';
  }

  get isDocument() {
    return this.document instanceof foundry.abstract.Document;
  }

  get data() {
    return getProperty(this.document, this.updateDataPrefix);
  }

  async _prepareContext() {
    const sections = CONST.playlistSections[this.document.documentName];

    const playlists = Object.entries(sections).map(([key, config]) => {
      const playlist = game.playlists.get(getProperty(this.data, `music.${key}.playlist`));
      const tracks =
        playlist?.playbackOrder?.map((id) => {
          const track = playlist.sounds.get(id);
          return { id, name: track.name };
        }) || [];

      return {
        key,
        label: game.i18n.localize(config.label),
        playlist,
        tracks,
        data: getProperty(this.data, `music.${key}`) || {},
        allowPriority: true
      };
    });

    return { playlists };
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

    const prevData = getProperty(this.data, `music.${section}`);
    if (!prevData?.priority) {
      updateData[`music.${section}.priority`] = sectionConfig.priority;
    }

    await this.updateObject(updateData);
  }

  async updateObject(data) {
    const expandedData = Object.entries(data).reduce((acc, [key, value]) => {
      acc[`${this.updateDataPrefix}.${key}`] = value;
      return acc;
    }, {});

    if (this.isDocument) {
      return this.document.update(expandedData);
    }

    if (this.document.documentName === 'DefaultMusic') {
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
    await this.updateObject(formData.object);
  }

  async close(...args) {
    if (this.document.apps) delete this.document.apps[this.appId];
    game.vgmusic?.musicController?.playCurrentTrack();
    return super.close(...args);
  }

  static async #openPlaylist(event, target) {
    const playlistId = target.closest('.playlist-section').dataset.itemId;
    const playlist = game.playlists.get(playlistId);
    if (playlist) playlist.sheet.render(true);
  }

  static async #deletePlaylist(event, target) {
    const app = target.closest('[data-application-id]');
    const appInstance = ui.windows[app.dataset.applicationId];
    const section = target.closest('.playlist-section').dataset.section;

    await appInstance.updateObject({ [`music.-=${section}`]: null });
  }
}

/**
 * Initialize module hooks and patches
 */
export function initializeModule() {
  // Patch ActorSheet to add music button
  libWrapper.register(CONST.moduleId, 'ActorSheet.prototype._getHeaderButtons', function (wrapped) {
    const buttons = wrapped();

    if (game.user.isGM) {
      buttons.unshift({
        label: game.i18n.localize('VGMusic.CombatMusic'),
        class: 'configure-combat-music',
        icon: 'fas fa-music',
        onclick: (event) => {
          event.preventDefault();
          new VGMusicConfig(this.actor, {
            top: this.position.top + 40,
            left: this.position.left + (this.position.width - 400) / 2
          }).render(true);
        }
      });
    }

    return buttons;
  });

  // Patch Combat to refresh music on turn changes
  libWrapper.register(CONST.moduleId, 'CONFIG.Combat.documentClass.prototype.setupTurns', function (wrapped, ...args) {
    const result = wrapped(...args);
    game.vgmusic?.musicController?.playCurrentTrack();
    return result;
  });

  // Patch SceneControls to add music toggle buttons
  libWrapper.register(CONST.moduleId, 'SceneControls.prototype._getControlButtons', function (wrapped, ...args) {
    const result = wrapped(...args);

    const soundsGroup = result.find((group) => group.name === 'sounds');
    if (soundsGroup) {
      soundsGroup.tools.push(
        {
          name: 'suppress-area-music',
          title: 'VGMusic.Controls.SuppressAreaMusic',
          icon: 'fas fa-dungeon',
          toggle: true,
          active: game.settings.get(CONST.moduleId, CONST.settings.suppressArea),
          onClick: (toggled) => {
            game.settings.set(CONST.moduleId, CONST.settings.suppressArea, toggled);
          }
        },
        {
          name: 'suppress-combat-music',
          title: 'VGMusic.Controls.SuppressCombatMusic',
          icon: 'fas fa-fist-raised',
          toggle: true,
          active: game.settings.get(CONST.moduleId, CONST.settings.suppressCombat),
          onClick: (toggled) => {
            game.settings.set(CONST.moduleId, CONST.settings.suppressCombat, toggled);
          }
        }
      );
    }

    return result;
  });
}

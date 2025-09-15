import { CONST } from './config.mjs';
import { getProperty } from './helpers.mjs';
import { migrateAllVGMusicFlags, migrateVGMusicFlags, needsMigration } from './helpers.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { DragDrop } = foundry.applications.ux;

/**
 * Music configuration application
 */
export class VGMusicConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'vgmusic-config',
    tag: 'form',
    window: { title: 'VGMusic.ConfigTitle', icon: 'fas fa-music', resizable: true, minimizable: true },
    modal: true,
    classes: ['vgmusic-config', 'dnd5e2'],
    form: {
      handler: VGMusicConfig.formHandler,
      closeOnSubmit: false,
      submitOnChange: false
    },
    position: { width: 'auto', height: 'auto' },
    actions: {
      reset: VGMusicConfig.handleReset,
      openPlaylist: VGMusicConfig.openPlaylist,
      deletePlaylist: VGMusicConfig.deletePlaylist
    },
    dragDrop: [
      {
        dragSelector: '.playlist-section-item[data-reorderable="true"]',
        dropSelector: '.playlist-section-list',
        permissions: { dragstart: true, drop: true },
        callbacks: {}
      },
      {
        dragSelector: null,
        dropSelector: '.playlist-section[data-section]',
        permissions: { dragstart: false, drop: true },
        callbacks: {}
      }
    ]
  };

  /** @override */
  static PARTS = { form: { template: 'modules/foundryvtt-vgmusic/templates/music-config.hbs' } };

  config = [];

  /**
   * Create a new configuration instance
   * @param {Object} object The document object to configure
   * @param {Object} [options={}] Additional application options
   */
  constructor(object, options = {}) {
    super(options);
    this.document = object || game.settings.get(CONST.moduleId, CONST.settings.defaultMusic);
    if (game.user.isGM && this.isDocument && needsMigration(this.document)) {
      console.log(`VGMusic | Auto-migrating ${this.document.name} before opening config`);
      migrateVGMusicFlags(this.document).then(() => {
        if (this.rendered) this.render();
      });
    }
  }

  get updateDataPrefix() {
    return this.isDocument ? 'flags.foundryvtt-vgmusic' : 'data.vgmusic';
  }

  get isDocument() {
    return this.document instanceof foundry.abstract.Document;
  }

  /**
   * Initialize the playlist configuration from document or defaults
   */
  initializeConfig() {
    try {
      const sections = CONST.playlistSections[this.document.documentName];
      if (!sections) {
        console.error('VGMusic | No sections found for document type:', this.document.documentName);
        this.config = [];
        return;
      }
      const data = getProperty(this.document, this.updateDataPrefix) || {};
      this.config = Object.entries(sections).map(([key, sectionConfig]) => {
        const sectionData = getProperty(data, `music.${key}`) || {};
        const playlistId = sectionData.playlist;
        const playlist = playlistId ? game.playlists.get(playlistId) : null;

        const tracks =
          playlist?.playbackOrder?.map((id) => {
            const track = playlist.sounds.get(id);
            return { id, name: track.name };
          }) || [];
        return {
          id: key,
          label: sectionConfig.label,
          order: sectionData.order || sectionConfig.priority || 0,
          enabled: !!playlist,
          playlist,
          tracks,
          data: sectionData,
          allowPriority: true,
          sortable: true
        };
      });
      this.config.sort((a, b) => a.order - b.order);
    } catch (error) {
      console.error('VGMusic | Error initializing configuration:', error);
      this.config = [];
    }
  }

  /** @override */
  _prepareContext(options) {
    this.initializeConfig();
    const playlistConfig = this.config.map((section, index) => ({ ...section, index, labelLocalized: game.i18n.localize(section.label) }));
    const buttons = [
      { type: 'submit', icon: 'fas fa-save', label: 'VGMusic.UI.Save' },
      { type: 'button', action: 'reset', icon: 'fas fa-undo', label: 'VGMusic.UI.Reset' }
    ];
    return { playlistConfig, buttons, documentType: this.document.documentName };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.setDraggableAttributes();
    this.setupDragDrop();
  }

  /**
   * Set up drag and drop handlers for both reordering and external drops
   */
  setupDragDrop() {
    this.options.dragDrop.forEach((dragDropOptions, index) => {
      if (index === 0) {
        dragDropOptions.callbacks = {
          dragstart: this.onDragStart.bind(this),
          dragover: this.onDragOver.bind(this),
          drop: this.onDropReorder.bind(this)
        };
      } else {
        dragDropOptions.callbacks = {
          dragover: this.onDragOverExternal.bind(this),
          drop: this.onDropExternal.bind(this)
        };
      }
      const dragDropHandler = new DragDrop(dragDropOptions);
      dragDropHandler.bind(this.element);
    });
  }

  /**
   * Set draggable attributes on playlist items
   */
  setDraggableAttributes() {
    const items = this.element.querySelectorAll('.playlist-section-item');
    items.forEach((item, index) => {
      const li = item.closest('li');
      const section = this.config[index];
      const isSortable = section?.sortable !== false;
      item.setAttribute('draggable', isSortable ? 'true' : 'false');
      item.setAttribute('data-reorderable', isSortable ? 'true' : 'false');
    });
  }

  /**
   * Handle drag start event for internal reordering
   */
  onDragStart(event) {
    try {
      const li = event.currentTarget.closest('li');
      if (!li || li.classList.contains('not-sortable')) {
        console.error('VGMusic | Drag start blocked - not sortable');
        return false;
      }
      this._formState = this._captureFormState();
      const sectionIndex = li.dataset.index;
      const dragData = { type: 'playlist-config-reorder', index: sectionIndex };
      event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
      li.classList.add('dragging');
      return true;
    } catch (error) {
      console.error('VGMusic | Error starting drag:', error);
      return false;
    }
  }

  /**
   * Handle drag over event for internal reordering
   */
  onDragOver(event) {
    event.preventDefault();
    const list = this.element.querySelector('.playlist-section-list');
    if (!list) {
      console.warn('VGMusic | No playlist section list found');
      return;
    }
    const draggingItem = list.querySelector('.dragging');
    if (!draggingItem) return;
    const items = Array.from(list.querySelectorAll('li:not(.dragging)'));
    if (!items.length) return;
    const targetItem = this.getDragTarget(event, items);
    if (!targetItem) return;
    const rect = targetItem.getBoundingClientRect();
    const dropAfter = event.clientY > rect.top + rect.height / 2;
    this.removeDropPlaceholders();
    this.createDropPlaceholder(targetItem, dropAfter);
  }

  /**
   * Handle drag over event for external drops
   */
  onDragOverExternal(event) {
    event.preventDefault();
    const hasExternalData = event.dataTransfer.types.includes('text/plain');
    if (hasExternalData) event.currentTarget.classList.add('drop-hover');
  }

  /**
   * Find the target element for dropping
   */
  getDragTarget(event, items) {
    try {
      return (
        items.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = event.clientY - (box.top + box.height / 2);
          if (closest === null || Math.abs(offset) < Math.abs(closest.offset)) return { element: child, offset: offset };
          else return closest;
        }, null)?.element || null
      );
    } catch (error) {
      console.error('VGMusic | Error finding drag target:', error);
      return null;
    }
  }

  /**
   * Handle drop event for internal reordering
   */
  async onDropReorder(event) {
    try {
      event.preventDefault();
      const dataString = event.dataTransfer.getData('text/plain');
      if (!dataString) return false;
      const data = JSON.parse(dataString);
      if (!data || data.type !== 'playlist-config-reorder') return false;
      const sourceIndex = parseInt(data.index);
      if (isNaN(sourceIndex)) return false;
      const list = this.element.querySelector('.playlist-section-list');
      const items = Array.from(list.querySelectorAll('li:not(.dragging)'));
      const targetItem = this.getDragTarget(event, items);
      if (!targetItem) return false;
      const targetIndex = parseInt(targetItem.dataset.index);
      if (isNaN(targetIndex)) return false;
      const rect = targetItem.getBoundingClientRect();
      const dropAfter = event.clientY > rect.top + rect.height / 2;
      let newIndex = dropAfter ? targetIndex + 1 : targetIndex;
      if (sourceIndex < newIndex) newIndex--;
      const [movedItem] = this.config.splice(sourceIndex, 1);
      this.config.splice(newIndex, 0, movedItem);
      this.updatePlaylistOrder();
      if (this._formState) for (const section of this.config) if (section.id in this._formState) section.enabled = this._formState[section.id];
      this.render(false);
      return true;
    } catch (error) {
      console.error('VGMusic | Error handling reorder drop:', error);
      return false;
    } finally {
      this.cleanupDragElements();
      delete this._formState;
    }
  }

  /**
   * Handle drop event for external playlist/sound drops
   */
  async onDropExternal(event) {
    try {
      event.preventDefault();
      event.currentTarget.classList.remove('drop-hover');
      const dataString = event.dataTransfer.getData('text/plain');
      if (!dataString) return false;
      let data;
      try {
        data = JSON.parse(dataString);
      } catch (e) {
        console.error('VGMusic | Failed to parse drag data:', e);
        return false;
      }
      if (data.type === 'playlist-config-reorder') return false;
      if (!['Playlist', 'PlaylistSound'].includes(data.type) || !data.uuid) return false;
      const section = event.currentTarget.dataset.section;
      if (!section) return false;
      const document = await fromUuid(data.uuid);
      if (!document) return false;
      let playlist, sound;
      if (document instanceof PlaylistSound) {
        playlist = document.parent;
        sound = document;
      } else if (document instanceof Playlist) playlist = document;
      else return false;
      const sectionConfig = CONST.playlistSections[this.document.documentName][section];
      if (!sectionConfig) return false;
      const updateData = { [`music.${section}.playlist`]: playlist.id, [`music.${section}.initialTrack`]: sound?.id || '' };
      const currentData = getProperty(this.document, this.updateDataPrefix) || {};
      const prevData = getProperty(currentData, `music.${section}`);
      if (!prevData?.priority) updateData[`music.${section}.priority`] = sectionConfig.priority;
      await this.updateObject(updateData);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update playlist order values after reordering
   */
  updatePlaylistOrder() {
    this.config.forEach((section, idx) => {
      section.order = (idx + 1) * 10;
    });
  }

  /**
   * Create a visual placeholder for drop position
   */
  createDropPlaceholder(targetItem, dropAfter) {
    const placeholder = document.createElement('div');
    placeholder.classList.add('drop-placeholder');
    if (dropAfter) targetItem.after(placeholder);
    else targetItem.before(placeholder);
  }

  /**
   * Remove all drop placeholders
   */
  removeDropPlaceholders() {
    const placeholders = this.element.querySelectorAll('.drop-placeholder');
    placeholders.forEach((el) => el.remove());
  }

  /**
   * Clean up visual elements after dragging
   */
  cleanupDragElements() {
    const draggingItems = this.element.querySelectorAll('.dragging');
    draggingItems.forEach((el) => el.classList.remove('dragging'));
    this.removeDropPlaceholders();
    const dropHoverItems = this.element.querySelectorAll('.drop-hover');
    dropHoverItems.forEach((el) => el.classList.remove('drop-hover'));
  }

  /**
   * Capture current form state for playlist enablement
   */
  _captureFormState() {
    const state = {};
    const checkboxes = this.element.querySelectorAll('input[type="checkbox"][name^="enabled-"]');
    checkboxes.forEach((checkbox) => {
      const sectionId = checkbox.name.replace('enabled-', '');
      state[sectionId] = checkbox.checked;
    });
    return state;
  }

  async updateObject(data) {
    const expandedData = Object.entries(data).reduce((acc, [key, value]) => {
      acc[`${this.updateDataPrefix}.${key}`] = value;
      return acc;
    }, {});
    if (this.isDocument) {
      const result = await this.document.update(expandedData);
      this.render(false);
      return result;
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

  /**
   * Static action handlers
   */
  static handleReset(event, _form) {
    event.preventDefault();
    this.initializeConfig();
    this.render(false);
  }

  static async openPlaylist(event, target) {
    const playlistId = target.closest('.playlist-section').dataset.itemId;
    const playlist = game.playlists.get(playlistId);
    if (playlist) playlist.sheet.render(true);
  }

  static async deletePlaylist(event, target) {
    const section = target.closest('.playlist-section').dataset.section;
    await this.updateObject({ [`music.-=${section}`]: null });
  }

  /** @override */
  static async formHandler(event, form, formData) {
    const updateData = Object.fromEntries(Object.entries(formData.object).filter(([key]) => key.startsWith('music.')));
    if (Object.keys(updateData).length > 0) {
      try {
        await this.updateObject(updateData);
        game.vgmusic?.musicController?.playCurrentTrack();
        this.close();
      } catch (error) {
        console.error('VGMusic | Error updating data:', error);
        ui.notifications.error('Failed to save music configuration');
        return false;
      }
    } else {
      this.close();
    }
    return true;
  }
}

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

export function getActorSheetHeaderControls(sheet, buttons) {
  try {
    if (!game.user.isGM) return;
    const clickHandler = (event) => {
      event.preventDefault();
      const config = new VGMusicConfig(sheet.document);
      config.render(true);
    };
    buttons.unshift({
      label: game.i18n.localize('VGMusic.CombatMusic'),
      class: 'configure-combat-music',
      icon: 'fas fa-music',
      onClick: clickHandler
    });
  } catch (error) {
    console.error('VGMusic | Error adding actor sheet header controls:', error);
  }
}

export function getTidySheetHeaderControls(api) {
  api.registerActorHeaderControls?.({
    controls: [
      {
        icon: 'fas fa-music',
        label: game.i18n.localize('VGMusic.CombatMusic'),
        async onClickAction() {
          if (!game.user.isGM) return;
          new VGMusicConfig(this.document).render(true);
        }
      }
    ]
  });
}

export function handleSceneConfigRender(app, html) {
  try {
    const playlistSoundSelect = html.querySelector('select[name="playlistSound"]');
    if (!playlistSoundSelect) return;
    const existingFormGroup = playlistSoundSelect.closest('.form-group');
    if (!existingFormGroup) return;
    const newFormGroup = document.createElement('div');
    newFormGroup.className = 'form-group';
    const label = document.createElement('label');
    label.textContent = game.i18n.localize('VGMusic.CombatMusic');
    const formFields = document.createElement('div');
    formFields.className = 'form-fields';
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = 'vgmusic-scene';
    button.innerHTML = `<i class="fas fa-music"></i> ${game.i18n.localize('VGMusic.ConfigTitle')}`;
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = game.i18n.localize('VGMusic.Settings.DefaultMusic.Hint');
    formFields.appendChild(button);
    newFormGroup.appendChild(label);
    newFormGroup.appendChild(formFields);
    newFormGroup.appendChild(hint);
    existingFormGroup.insertAdjacentElement('afterend', newFormGroup);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      new VGMusicConfig(app.document).render(true);
    });
  } catch (error) {
    console.error('VGMusic | Error adding scene config button:', error);
  }
}

export function handleUpdateCombat(combat, updateData) {
  if (combat.started && (updateData.turn != null || updateData.round != null)) game.vgmusic?.musicController?.playCurrentTrack();
}

export function handleDeleteCombat() {
  game.vgmusic?.musicController?.playCurrentTrack();
}

export function handleCanvasReady() {
  game.vgmusic?.musicController?.playCurrentTrack();
}

export function handleUpdateScene(scene, updateData) {
  if ('flags' in updateData && updateData.flags?.[CONST.moduleId]) game.vgmusic?.musicController?.playCurrentTrack();
  if ('active' in updateData) {
    if (updateData.active !== true) scene.unsetFlag(CONST.moduleId, 'playlist').catch(() => {});
    game.vgmusic?.musicController?.playCurrentTrack();
  }
}

export function handleUpdateActor(actor, updateData) {
  if ('flags' in updateData && updateData.flags?.[CONST.moduleId]) game.vgmusic?.musicController?.playCurrentTrack();
}

export async function handleReady() {
  if (game.user.isGM) await migrateAllVGMusicFlags();
  setTimeout(() => {
    game.vgmusic?.musicController?.playCurrentTrack();
  }, 1000);
}

// scripts/vgmusic.mjs
import { CONST } from './config.mjs';
import { registerSettings, registerKeybindings } from './settings.mjs';
import { MusicController } from './music-controller.mjs';
import { initializeModule } from './app.mjs';

// Initialize module
Hooks.once('init', async () => {
  if (typeof libWrapper !== 'function') {
    console.error('VGMusic | lib-wrapper is required for this module to function');
    return;
  }

  console.log('VGMusic | Initializing Video Game Music module');

  // Set up global reference
  game.vgmusic = {
    musicController: new MusicController()
  };

  // Register settings and keybindings
  registerSettings();
  registerKeybindings();

  // Preload templates
  await loadTemplates(['modules/foundryvtt-vgmusic/templates/music-config.hbs', 'modules/foundryvtt-vgmusic/templates/playlist-section.hbs']);
});

// Set up patches and hooks
Hooks.once('ready', () => {
  if (typeof libWrapper !== 'function') return;

  initializeModule();

  // Add scene config button
  Hooks.on('renderSceneConfig', (app, html) => {
    const elem = html.find('select[name="playlistSound"]').parent();
    const button = `<button type="button" data-action="vgmusic-scene">
      <i class="fas fa-music"></i> ${game.i18n.localize('VGMusic.CombatMusic')}
    </button>`;

    elem.after(button);

    html.find('button[data-action="vgmusic-scene"]').on('click', (event) => {
      event.preventDefault();
      new game.vgmusic.VGMusicConfig(app.object).render(true);
    });
  });
});

// Music control hooks
Hooks.on('updateCombat', (combat, updateData) => {
  if (combat.started && (updateData.turn != null || updateData.round != null)) {
    game.vgmusic?.musicController?.playCurrentTrack();
  }
});

Hooks.on('deleteCombat', () => {
  game.vgmusic?.musicController?.playCurrentTrack();
});

Hooks.on('canvasReady', () => {
  game.vgmusic?.musicController?.playCurrentTrack();
});

Hooks.on('updateScene', async (scene, updateData) => {
  if ('active' in updateData) {
    if (updateData.active !== true) {
      await scene.unsetFlag(CONST.moduleId, 'playlist');
    }
    game.vgmusic?.musicController?.playCurrentTrack();
  }
});

import { CONST } from './config.mjs';
import { registerSettings, registerKeybindings } from './settings.mjs';
import { MusicController } from './music-controller.mjs';
import { VGMusicConfig, getSceneControlButtons, getActorSheetHeaderControls, handleSceneConfigRender } from './app.mjs';

// Initialize module
Hooks.once('init', async () => {
  console.log('VGMusic | Initializing Video Game Music module');

  // Set up global reference
  game.vgmusic = {
    musicController: new MusicController(),
    VGMusicConfig: VGMusicConfig
  };

  // Register settings and keybindings
  registerSettings();
  registerKeybindings();

  // Preload templates
  await loadTemplates(['modules/foundryvtt-vgmusic/templates/music-config.hbs', 'modules/foundryvtt-vgmusic/templates/playlist-section.hbs']);
});

// Scene control buttons
Hooks.on('getSceneControlButtons', getSceneControlButtons);

// Actor sheet header controls
Hooks.on('getHeaderControlsBaseActorSheet', getActorSheetHeaderControls);

// Scene config button
Hooks.on('renderSceneConfig', handleSceneConfigRender);

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

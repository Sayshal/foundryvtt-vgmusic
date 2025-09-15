import { CONST } from './config.mjs';
import { registerSettings, registerKeybindings } from './settings.mjs';
import { MusicController } from './music-controller.mjs';
import {
  VGMusicConfig,
  getSceneControlButtons,
  getActorSheetHeaderControls,
  handleSceneConfigRender,
  handleUpdateCombat,
  handleDeleteCombat,
  handleCanvasReady,
  handleUpdateScene,
  handleUpdateActor,
  handleReady
} from './app.mjs';

Hooks.once('init', async () => {
  console.log('VGMusic | Initializing Video Game Music module');
  game.vgmusic = { musicController: new MusicController(), VGMusicConfig: VGMusicConfig };
  registerSettings();
  registerKeybindings();
  await loadTemplates(['modules/foundryvtt-vgmusic/templates/music-config.hbs']);
});
Hooks.once('ready', handleReady);
Hooks.on('getSceneControlButtons', getSceneControlButtons);
Hooks.on('getHeaderControlsBaseActorSheet', getActorSheetHeaderControls);
Hooks.on('renderSceneConfig', handleSceneConfigRender);
Hooks.on('updateCombat', handleUpdateCombat);
Hooks.on('deleteCombat', handleDeleteCombat);
Hooks.on('canvasReady', handleCanvasReady);
Hooks.on('updateScene', handleUpdateScene);
Hooks.on('updateActor', handleUpdateActor);

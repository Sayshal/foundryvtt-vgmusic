import { CONST } from './config.mjs';
import { VGMusicConfig } from './app.mjs';

/**
 * Register module settings and configuration menu
 */
export function registerSettings() {
  // Silent Combat Music Mode
  game.settings.register(CONST.moduleId, CONST.settings.silentCombatMusicMode, {
    name: 'VGMusic.Settings.SilentCombatMusicMode.Name',
    hint: 'VGMusic.Settings.SilentCombatMusicMode.Hint',
    scope: 'world',
    config: true,
    type: String,
    choices: {
      [CONST.silentModes.highestPriority]: 'VGMusic.Settings.SilentCombatMusicMode.HighestPriority',
      [CONST.silentModes.lastActor]: 'VGMusic.Settings.SilentCombatMusicMode.LastActor',
      [CONST.silentModes.area]: 'VGMusic.Settings.SilentCombatMusicMode.Area',
      [CONST.silentModes.generic]: 'VGMusic.Settings.SilentCombatMusicMode.Generic'
    },
    default: CONST.silentModes.highestPriority,
    onChange: () => {
      game.vgmusic?.musicController?.playCurrentTrack();
    }
  });

  // Default Music Configuration Menu
  game.settings.registerMenu(CONST.moduleId, 'defaultMusicMenu', {
    name: 'VGMusic.Settings.DefaultMusic.Name',
    label: 'VGMusic.Settings.DefaultMusic.Label',
    hint: 'VGMusic.Settings.DefaultMusic.Hint',
    icon: 'fas fa-music',
    type: VGMusicConfig,
    restricted: true
  });

  // Default Music Data
  game.settings.register(CONST.moduleId, CONST.settings.defaultMusic, {
    name: 'VGMusic.Settings.DefaultMusic.Name',
    scope: 'world',
    config: false,
    type: Object,
    default: {
      documentName: 'DefaultMusic',
      data: { vgmusic: { music: {} } }
    }
  });

  // Suppress Area Music
  game.settings.register(CONST.moduleId, CONST.settings.suppressArea, {
    name: 'VGMusic.Settings.SuppressArea.Name',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false,
    onChange: () => {
      game.vgmusic?.musicController?.playCurrentTrack();
    }
  });

  // Suppress Combat Music
  game.settings.register(CONST.moduleId, CONST.settings.suppressCombat, {
    name: 'VGMusic.Settings.SuppressCombat.Name',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false,
    onChange: () => {
      game.vgmusic?.musicController?.playCurrentTrack();
    }
  });
}

/**
 * Register keybindings
 */
export function registerKeybindings() {
  game.keybindings.register(CONST.moduleId, 'toggleAreaMusic', {
    name: 'VGMusic.Keybindings.ToggleAreaMusic',
    onDown: () => toggleAreaMusic()
  });

  game.keybindings.register(CONST.moduleId, 'toggleCombatMusic', {
    name: 'VGMusic.Keybindings.ToggleCombatMusic',
    onDown: () => toggleCombatMusic()
  });
}

/**
 * Toggle area music suppression
 */
async function toggleAreaMusic() {
  const current = game.settings.get(CONST.moduleId, CONST.settings.suppressArea);
  await game.settings.set(CONST.moduleId, CONST.settings.suppressArea, !current);
  ui.controls.initialize();
}

/**
 * Toggle combat music suppression
 */
async function toggleCombatMusic() {
  const current = game.settings.get(CONST.moduleId, CONST.settings.suppressCombat);
  await game.settings.set(CONST.moduleId, CONST.settings.suppressCombat, !current);
  ui.controls.initialize();
}

import { VGMusicConfig } from './applications/_module.mjs';

export function registerSettings() {
  const modName = 'vgmusic';

  /**
   * Silent Combat Music
   */
  game.settings.register(modName, 'silentCombatMusicMode', {
    name: 'VGMusic.SETTINGS.SilentCombatMusicMode.Name',
    hint: 'VGMusic.SETTINGS.SilentCombatMusicMode.Hint',
    scope: 'world',
    config: true,
    type: String,
    choices: {
      highestPriority: game.i18n.localize('VGMusic.SETTINGS.SilentCombatMusicMode.Options.highestPriority'),
      lastActor: game.i18n.localize('VGMusic.SETTINGS.SilentCombatMusicMode.Options.lastActor'),
      area: game.i18n.localize('VGMusic.SETTINGS.SilentCombatMusicMode.Options.area'),
      generic: game.i18n.localize('VGMusic.SETTINGS.SilentCombatMusicMode.Options.generic')
    },
    default: 'highestPriority',
    onChange: () => {
      vgmusic.utils.MusicController.playCurrentTrack();
    }
  });

  /**
   * Default Combat Music
   */
  game.settings.registerMenu(modName, 'defaultMusic', {
    label: 'VGMusic.SETTINGS.DefaultMusic.Label',
    name: 'VGMusic.SETTINGS.DefaultMusic.Name',
    hint: 'VGMusic.SETTINGS.DefaultMusic.Hint',
    icon: 'fas fa-music',
    type: VGMusicConfig,
    restricted: true
  });
  game.settings.register(modName, 'defaultMusic', {
    name: 'VGMusic.SETTINGS.DefaultMusic.Name',
    scope: 'world',
    config: false,
    type: Object,
    default: {
      documentName: 'DefaultMusic',
      data: {
        vgmusic: {
          music: {}
        }
      }
    }
  });

  game.settings.register(modName, 'supress.area', {
    name: 'supress.area',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false,
    onChange: () => {
      vgmusic.utils.MusicController.playCurrentTrack();
    }
  });
  game.settings.register(modName, 'supress.combat', {
    name: 'supress.combat',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false,
    onChange: () => {
      vgmusic.utils.MusicController.playCurrentTrack();
    }
  });
}

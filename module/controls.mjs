export const register = () => {
  // Toggle area music
  game.keybindings.register('vgmusic', 'toggleAreaMusic', {
    name: 'VGMusic.CONTROLS.ToggleAreaMusic.Name',
    onDown: () => {
      game.VGMusic.controls.toggleAreaMusic();
    }
  });

  // Toggle combat music
  game.keybindings.register('vgmusic', 'toggleCombatMusic', {
    name: 'VGMusic.CONTROLS.ToggleCombatMusic.Name',
    onDown: () => {
      game.VGMusic.controls.toggleCombatMusic();
    }
  });
};

export const toggleAreaMusic = async function () {
  const value = game.settings.get('vgmusic', 'supress.area');
  await game.settings.set('vgmusic', 'supress.area', !value);
  ui.controls.initialize();
};

export const toggleCombatMusic = async function () {
  const value = game.settings.get('vgmusic', 'supress.combat');
  await game.settings.set('vgmusic', 'supress.combat', !value);
  ui.controls.initialize();
};

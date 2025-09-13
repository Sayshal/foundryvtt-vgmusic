export const patchSceneControls = function () {
  const clsPath = 'SceneControls';

  /* -------------------------------------- */
  /* _getControlButtons
  /* -------------------------------------- */
  libWrapper.register('vgmusic', `${clsPath}.prototype._getControlButtons`, function (wrapped, ...args) {
    let result = wrapped(...args);

    {
      const tools = [
        {
          name: 'supress-area-music',
          title: 'VGMusic.SceneControls.SupressAreaMusic',
          icon: 'fas fa-dungeon',
          toggle: true,
          active: game.settings.get('vgmusic', 'supress.area'),
          onClick: (toggled) => {
            game.settings.set('vgmusic', 'supress.area', toggled);
          }
        },
        {
          name: 'supress-combat-music',
          title: 'VGMusic.SceneControls.SupressCombatMusic',
          icon: 'fas fa-fist-raised',
          toggle: true,
          active: game.settings.get('vgmusic', 'supress.combat'),
          onClick: (toggled) => {
            game.settings.set('vgmusic', 'supress.combat', toggled);
          }
        }
      ];

      const group = result.find((o) => o.name === 'sounds');
      group.tools.push(...tools);
    }

    return result;
  });
};

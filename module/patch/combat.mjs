export const patchCombat = function () {
  const clsPath = 'CONFIG.Combat.documentClass';

  /* -------------------------------------- */
  /* setupTurns
  /* -------------------------------------- */
  libWrapper.register('vgmusic', `${clsPath}.prototype.setupTurns`, function (wrapped, ...args) {
    const result = wrapped(...args);

    // Refresh combat music
    vgmusic.utils.MusicController.playCurrentTrack();

    return result;
  });
};

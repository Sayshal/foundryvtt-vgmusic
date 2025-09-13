export const patchActorSheet = function () {
  const clsPath = "ActorSheet";
  const cls = ActorSheet;

  /* -------------------------------------- */
  /* _getHeaderButtons
  /* -------------------------------------- */
  libWrapper.register("vgmusic", `${clsPath}.prototype._getHeaderButtons`, function (wrapped) {
    let buttons = wrapped();

    // Add music selector
    if (game.user.isGM) {
      buttons.splice(0, 0, {
        label: game.i18n.localize("VGMusic.CombatMusic"),
        class: "configure-combat-music",
        icon: "fas fa-music",
        onclick: (ev) => {
          this._onConfigureCombatMusic(ev);
        },
      });
    }

    return buttons;
  });

  /* -------------------------------------- */
  /* _onConfigureCombatMusic
  /* -------------------------------------- */
  cls.prototype._onConfigureCombatMusic = function (event) {
    event.preventDefault();
    new vgmusic.applications.VGMusicConfig(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2,
    }).render(true);
  };
};

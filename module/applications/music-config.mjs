export class VGMusicConfig extends FormApplication {
  constructor(object, options) {
    super(object || game.settings.get("vgmusic", "defaultMusic"), options);

    if (this.object.apps != null) this.object.apps[this.appId] = this;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: game.i18n.localize("VGMusic.SceneMusic"),
      classes: ["scene-music"],
      width: 480,
      height: 360,
      template: "modules/vgmusic/templates/apps/music-config.hbs",
      closeOnSubmit: false,
      submitOnClose: true,
      submitOnChange: true,
      resizable: true,
      dragDrop: [{ dropSelector: ".playlist" }],
    });
  }

  get updateDataPrefix() {
    if (this.isDocument) return "flags.vgmusic";
    return "data.vgmusic";
  }

  get isDocument() {
    return this.object instanceof foundry.abstract.Document;
  }

  get data() {
    return getProperty(this.object, this.updateDataPrefix);
  }

  async updateObject(data) {
    // Turn update data follow a valid schema for the object
    data = Object.entries(data).reduce((cur, o) => {
      const key = `${this.updateDataPrefix}.${o[0]}`;
      cur[key] = o[1];

      return cur;
    }, {});

    // Handle Document
    if (this.isDocument) return this.object.update(data);

    // Handle config
    if (this.object.documentName === "DefaultMusic") {
      const prevData = game.settings.get("vgmusic", "defaultMusic");
      const updateData = foundry.utils.mergeObject(prevData, foundry.utils.expandObject(data), {
        inplace: false,
        performDeletions: true,
      });

      await game.settings.set("vgmusic", "defaultMusic", updateData);
      this.object = game.settings.get("vgmusic", "defaultMusic");
      return this.render();
    }
  }

  async _onDrop(event) {
    event.preventDefault();
    const section = event.currentTarget.dataset.section;

    const data = JSON.parse(event.dataTransfer.getData("text/plain"));
    if (!["Playlist", "PlaylistSound"].includes(data.type)) return;
    if (!data.uuid) return;

    const document = await fromUuid(data.uuid);
    let playlist, sound;
    if (document instanceof PlaylistSound) {
      playlist = document.parent;
      sound = document;
    } else {
      playlist = document;
    }

    const sectionConfig = CONFIG.VGMusic.playlistSections[this.object.documentName][section];
    const prio = sectionConfig.priority;

    const prevData = getProperty(this.data, `music.${section}`);
    const prefix = `music.${section}`;
    const updateData = {
      [`${prefix}.playlist`]: playlist.id,
      [`${prefix}.initialTrack`]: sound ? sound.id : "",
    };
    if (prevData?.priority == null) updateData[`${prefix}.priority`] = prio;

    await this.updateObject(updateData);
  }

  async getData() {
    const data = await super.getData();

    // Add playlist sections
    const sections = CONFIG.VGMusic.playlistSections[this.object.documentName];
    data.playlists = Object.entries(sections).map((o) => {
      const [k, v] = o;
      const playlist = game.playlists.get(getProperty(this.data, `music.${k}.playlist`));
      const tracks = (playlist?.playbackOrder ?? []).map((id) => {
        const track = playlist.sounds.get(id);
        return {
          id,
          name: track.name,
        };
      });

      return {
        key: k,
        label: game.i18n.localize(v.label),
        playlist,
        tracks,
        data: getProperty(this.data, `music.${k}`),
        allowPriority: true,
      };
    });

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".playlist .control .delete").on("click", this._onDeletePlaylist.bind(this));
    html.find(`*[data-action="open-playlist"]`).on("click", this._onOpenPlaylist.bind(this));
  }

  async _onDeletePlaylist(event) {
    event.preventDefault();
    const section = event.currentTarget.closest(".playlist").dataset.section;
    await this.updateObject({ [`music.-=${section}`]: null });
  }

  _onOpenPlaylist(event) {
    event.preventDefault();

    const playlistId = event.currentTarget.closest(".playlist").dataset.itemId;
    const playlist = game.playlists.get(playlistId);
    if (playlist) playlist.sheet.render(true);
  }

  async close(...args) {
    if (this.object.apps != null) delete this.object.apps[this.appId];

    vgmusic.utils.MusicController.playCurrentTrack();
    return super.close(...args);
  }

  async _updateObject(event, formData) {
    event.preventDefault();

    await this.updateObject(formData);
  }
}

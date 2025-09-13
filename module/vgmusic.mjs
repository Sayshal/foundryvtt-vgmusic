/**
 * Author: Furyspark
 * Software License: MIT
 */

// Import JavaScript modules
import { registerSettings } from "./settings.mjs";
import { preloadTemplates } from "./preloadTemplates.mjs";
import * as patch from "./patch/_module.mjs";
import * as utils from "./utils/_module.mjs";
import * as applications from "./applications/_module.mjs";
import { VGMusic } from "./config.mjs";
import * as controls from "./controls.mjs";

export { applications, utils, VGMusic as config };

globalThis.vgmusic = {
  applications,
  utils,
  config: VGMusic,
  controls,
};

// Initialize module
Hooks.once("init", async () => {
  if (typeof libWrapper !== "function") return;
  console.log("vgmusic | Initializing vgmusic");

  // Assign custom classes and constants here
  CONFIG.VGMusic = VGMusic;

  // Register custom module settings
  registerSettings();
  vgmusic.controls.register();

  // Register sockets

  // Preload Handlebars templates
  await preloadTemplates();
});

Hooks.once("setup", () => {});

// When ready
Hooks.once("ready", async () => {
  // Do anything once the module is ready
  if (typeof libWrapper !== "function") return;

  // Patch stuff
  for (const fn of Object.values(patch)) {
    fn();
  }
});

// Add any additional hooks if necessary
Hooks.on("updateCombat", (combat, updateData) => {
  // If the combat turn is changed
  if (combat.started && (updateData.turn != null || updateData.round != null)) {
    utils.MusicController.playCurrentTrack();
  }
});

Hooks.on("deleteCombat", () => {
  utils.MusicController.playCurrentTrack();
});

Hooks.on("renderSceneConfig", (app, html) => {
  // Disable core stuff
  const elem = html.find(`select[name="playlistSound"]`).parent();

  const elemStr =
    `<button type="button" data-action="vgmusic-scene"><i class="fas fa-music"></i>` +
    `${game.i18n.localize("VGMusic.SceneMusic")}</button>`;
  elem.after(elemStr);

  html.find(`button[data-action="vgmusic-scene"]`).on("click", (event) => {
    event.preventDefault();
    new applications.VGMusicConfig(app.object).render(true);
  });
});

Hooks.on("canvasReady", () => {
  utils.MusicController.playCurrentTrack();
});

Hooks.on("updateScene", async (scene, updateData) => {
  if ("active" in updateData) {
    if (updateData.active !== true) {
      await scene.unsetFlag("vgmusic", "playlist");
    }
    utils.MusicController.playCurrentTrack();
  }
});

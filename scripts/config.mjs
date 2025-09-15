/**
 * Configuration constants for the VGMusic module
 */
export const CONST = {
  moduleId: 'vgmusic',

  settings: {
    silentCombatMusicMode: 'silentCombatMusicMode',
    defaultMusic: 'defaultMusic',
    suppressArea: 'suppressArea',
    suppressCombat: 'suppressCombat'
  },

  silentModes: {
    highestPriority: 'highestPriority',
    lastActor: 'lastActor',
    area: 'area',
    generic: 'generic'
  },

  playlistSections: {
    DefaultMusic: {
      combat: { label: 'VGMusic.PlaylistSection.Combat', priority: -5 }
    },
    Scene: {
      area: { label: 'VGMusic.PlaylistSection.Area', priority: -20 },
      combat: { label: 'VGMusic.PlaylistSection.Combat', priority: -10 }
    },
    Actor: {
      combat: { label: 'VGMusic.PlaylistSection.Combat', priority: 0 }
    }
  },

  documentSortPriority: ['Actor', 'Scene', 'DefaultMusic']
};

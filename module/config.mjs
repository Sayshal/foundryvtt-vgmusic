export const VGMusic = {
  playlistSections: {
    // Default music playlist sections
    DefaultMusic: {
      combat: {
        label: 'VGMusic.Scene.PlaylistSection.Combat',
        priority: -5
      }
    },

    // Scene playlist sections
    Scene: {
      area: {
        label: 'VGMusic.Scene.PlaylistSection.Area',
        priority: -20
      },
      combat: {
        label: 'VGMusic.Scene.PlaylistSection.Combat',
        priority: -10
      }
    },

    // Actor playlist sections
    Actor: {
      combat: {
        label: 'VGMusic.Scene.PlaylistSection.Combat',
        priority: 0
      }
    }
  }
};

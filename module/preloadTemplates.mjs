export async function preloadTemplates() {
  const templatePaths = ['modules/vgmusic/templates/apps/components/playlists.hbs'];

  return loadTemplates(templatePaths);
}

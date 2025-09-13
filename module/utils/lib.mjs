export const getFirstAvailableGM = function () {
  return (game.users
    .filter((o) => o.isGM && o.active)
    .sort((a, b) => {
      return a.id - b.id;
    }) || null)[0];
};

export const isHeadGM = function () {
  return game.user === getFirstAvailableGM();
};

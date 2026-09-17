"use strict";
let punchLocationBusy = false;
async function requirePunchLocation() {
  if (punchLocationBusy) return null;
  punchLocationBusy = true;
  const buttons = [...document.querySelectorAll('.overlay button')];
  const disabled = buttons.map(button => button.disabled);
  buttons.forEach(button => { button.disabled = true; });
  try {
    const location = await new Promise(resolve => {
      const timer = setTimeout(() => resolve(null), 20000);
      getLocation(value => { clearTimeout(timer); resolve(value); });
    });
    if (!location || location.lat === '' || location.lng === '' ||
        !Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lng))) {
      alert('Location is required to record attendance. Enable phone location and allow location access, then try again.');
      return null;
    }
    return location;
  } finally {
    buttons.forEach((button, index) => { button.disabled = disabled[index]; });
    punchLocationBusy = false;
  }
}

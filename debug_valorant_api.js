async function debug() {
  try {
    const res = await fetch('https://valorant-api.com/v1/weapons/skins');
    const data = await res.json();
    const primeSkins = data.data.filter(s => s.displayName.includes('Prime'));
    if (primeSkins.length > 0) {
      console.log('Found Prime Skin:', primeSkins[0].displayName);
      console.log('Levels:', JSON.stringify(primeSkins[0].levels, null, 2));
    } else {
      console.log('No Prime skins found');
    }
  } catch (e) {
    console.error(e);
  }
}
debug();

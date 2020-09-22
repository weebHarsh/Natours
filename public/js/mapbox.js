/* eslint-disable */

export const displayMap = locations => {
  mapboxgl.accessToken =
    'pk.eyJ1Ijoid2VlYmhhcnNoIiwiYSI6ImNrZjZkYnM0dzBkbTkyeG96YTloamt4OTkifQ.z_9ZjNICf0QHvWnj-0VU4Q';

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/weebharsh/ckf6q3hcy0fmj19s9lu10u45l',
    scrollZoom: false
    // center: [-118.2437, 34.0522],
    // zoom: 10,
    // interactive: false
  });

  const bounds = new mapboxgl.LngLatBounds();

  locations.forEach(loc => {
    // Create marker
    const el = document.createElement('div');
    el.className = 'marker';

    // Add marker
    new mapboxgl.Marker({
      element: el,
      anchor: 'bottom'
    })
      .setLngLat(loc.coordinates)
      .addTo(map);

    // Add Pop-up
    new mapboxgl.Popup({
      offset: 30
    })
      .setLngLat(loc.coordinates)
      .setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`)
      .addTo(map);

    // Extend map bounds to include current location
    bounds.extend(loc.coordinates);
  });

  map.fitBounds(bounds, {
    padding: {
      top: 180,
      bottom: 150,
      right: 100,
      left: 100
    }
  });
};

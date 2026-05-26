import fs from 'fs';
import path from 'path';

// Helper: Distance in meters between two coordinates (Equirectangular approximation for small scales)
function getDistanceAndAzimuth(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const latMean = ((lat1 + lat2) / 2) * rad;
  const dy = (lat2 - lat1) * 111139;
  const dx = (lon2 - lon1) * 111139 * Math.cos(latMean);
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  let azimuth = Math.atan2(dx, dy) * (180 / Math.PI);
  if (azimuth < 0) azimuth += 360;
  
  return { distance, azimuth };
}

// Overpass API caller for a single coordinate
async function fetchSurroundingBuildings(lat, lng, radius = 150) {
  const query = `
    [out:json];
    (
      way["building"](around:${radius}, ${lat}, ${lng});
      relation["building"](around:${radius}, ${lat}, ${lng});
    );
    out body;
    >;
    out skel qt;
  `;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Overpass API returned status: ${response.status}`);
  }
  return await response.json();
}

// Compute the 36-point horizon mask
function computeHorizonMask(venueLat, venueLng, osmData) {
  // Initialize 36 bins (every 10 degrees, centered on 0, 10, 20... 350) with 0 degrees elevation
  const mask = new Array(36).fill(0);

  // Map nodes for coordinate lookup
  const nodes = {};
  osmData.elements.forEach(el => {
    if (el.type === 'node') {
      nodes[el.id] = { lat: el.lat, lon: el.lon };
    }
  });

  // Process building outlines
  osmData.elements.forEach(el => {
    if (el.type === 'way' && el.nodes && el.tags) {
      // Resolve building height (OSM defaults to levels or flat height tags)
      let height = 15; // Default to 15m (approx. 4-5 stories, common in Gothenburg inner city)
      if (el.tags.height) {
        height = parseFloat(el.tags.height);
      } else if (el.tags['building:levels']) {
        const levels = parseFloat(el.tags['building:levels']);
        height = levels * 3.5; // Estimate 3.5m per level
      }

      // Check all line segments of the building
      for (let i = 0; i < el.nodes.length - 1; i++) {
        const nodeA = nodes[el.nodes[i]];
        const nodeB = nodes[el.nodes[i + 1]];
        if (!nodeA || !nodeB) continue;

        // Calculate length of wall segment in meters
        const { distance: segmentLen } = getDistanceAndAzimuth(nodeA.lat, nodeA.lon, nodeB.lat, nodeB.lon);
        
        // Subdivide segment into 2-meter chunks to capture precise azimuth headings
        const steps = Math.max(1, Math.floor(segmentLen / 2));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const pointLat = nodeA.lat + (nodeB.lat - nodeA.lat) * t;
          const pointLon = nodeA.lon + (nodeB.lon - nodeA.lon) * t;

          const { distance, azimuth } = getDistanceAndAzimuth(venueLat, venueLng, pointLat, pointLon);
          if (distance < 3) continue; // Ignore points on top of the venue itself

          // Elevation angle to roof edge: tan(theta) = height / distance
          const elevation = Math.atan2(height, distance) * (180 / Math.PI);

          // Find the nearest 10-degree bin
          const binIndex = Math.round(azimuth / 10) % 36;
          
          // Save the maximum height found at this angle
          if (elevation > mask[binIndex]) {
            mask[binIndex] = Math.round(elevation);
          }
        }
      }
    }
  });

  return mask;
}

// Master execution block
async function run() {
  const inputPath = path.resolve('scripts/input_venues.json');
  const outputPath = path.resolve('src/data/processed_venues.json');

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Create scripts/input_venues.json first.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const venues = JSON.parse(raw);

  console.log(`Starting V2 shadow calculations for ${venues.length} venues...`);
  const processed = [];

  for (const venue of venues) {
    console.log(`Analyzing: ${venue.name}...`);
    try {
      // Use custom outdoor coordinate if it exists, otherwise fall back to venue center
      const lat = venue.outdoorPoint?.lat ?? venue.lat;
      const lng = venue.outdoorPoint?.lng ?? venue.lng;

      const osmData = await fetchSurroundingBuildings(lat, lng);
      const horizonMask = computeHorizonMask(lat, lng, osmData);

      processed.push({
        ...venue,
        horizonMask
      });

      // Throttle queries to be nice to the free OSM Overpass public server
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (e) {
      console.error(`Failed to process ${venue.name}:`, e.message);
      processed.push({ ...venue, horizonMask: new Array(36).fill(0) });
    }
  }

  // Ensure output directory exists and write final JSON file
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2), 'utf8');
  console.log(`Success! Output written to src/data/processed_venues.json`);
}

run();
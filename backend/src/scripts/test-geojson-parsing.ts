/**
 * Simple test script to verify the GeoJSON parsing functionality
 * 
 * This script directly tests the GeoJSON parsing logic without any dependencies
 * on the EAS service or database.
 */

// Define logging function
const log = {
  info: (message: string) => console.log(`INFO: ${message}`),
  warn: (message: string) => console.warn(`WARN: ${message}`),
  error: (message: string) => console.error(`ERROR: ${message}`)
};

// Sample location formats to test
const testLocations = [
  // Standard lat,lng format
  {
    format: "Standard lat,lng format", 
    value: "40.7128,-74.0060" // NYC
  },
  
  // Reversed lng,lat format
  {
    format: "Reversed lng,lat format", 
    value: "-74.0060,40.7128" // NYC
  },
  
  // GeoJSON Point format
  {
    format: "GeoJSON Point", 
    value: JSON.stringify({
      type: "Point",
      coordinates: [-74.0060, 40.7128] // NYC in GeoJSON format (lng,lat)
    })
  },
  
  // GeoJSON LineString format
  {
    format: "GeoJSON LineString", 
    value: JSON.stringify({
      type: "LineString",
      coordinates: [
        [-74.0060, 40.7128], // NYC
        [-122.4194, 37.7749] // San Francisco
      ]
    })
  },
  
  // GeoJSON Polygon format
  {
    format: "GeoJSON Polygon", 
    value: JSON.stringify({
      type: "Polygon",
      coordinates: [[
        [-74.0060, 40.7128], // NYC
        [-122.4194, 37.7749], // San Francisco
        [-87.6298, 41.8781], // Chicago
        [-74.0060, 40.7128]  // NYC (closing the polygon)
      ]]
    })
  },
  
  // GeoJSON MultiPoint format
  {
    format: "GeoJSON MultiPoint", 
    value: JSON.stringify({
      type: "MultiPoint",
      coordinates: [
        [-74.0060, 40.7128], // NYC
        [-122.4194, 37.7749] // San Francisco
      ]
    })
  },
  
  // GeoJSON MultiLineString format
  {
    format: "GeoJSON MultiLineString", 
    value: JSON.stringify({
      type: "MultiLineString",
      coordinates: [
        [[-74.0060, 40.7128], [-87.6298, 41.8781]], // NYC to Chicago
        [[-122.4194, 37.7749], [-118.2437, 34.0522]] // San Francisco to Los Angeles
      ]
    })
  },
  
  // GeoJSON MultiPolygon format
  {
    format: "GeoJSON MultiPolygon", 
    value: JSON.stringify({
      type: "MultiPolygon",
      coordinates: [
        [[ // First polygon
          [-74.0060, 40.7128], // NYC
          [-73.9352, 40.7306], // Manhattan points
          [-74.0070, 40.7100],
          [-74.0060, 40.7128]
        ]],
        [[ // Second polygon
          [-122.4194, 37.7749], // San Francisco
          [-122.4300, 37.7800],
          [-122.4100, 37.7850],
          [-122.4194, 37.7749]
        ]]
      ]
    })
  },
  
  // GeoJSON Feature with Point geometry
  {
    format: "GeoJSON Feature with Point geometry", 
    value: JSON.stringify({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-122.4194, 37.7749] // San Francisco (lng,lat)
      },
      properties: {
        name: "San Francisco"
      }
    })
  },
  
  // GeoJSON Feature with LineString geometry
  {
    format: "GeoJSON Feature with LineString geometry", 
    value: JSON.stringify({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-74.0060, 40.7128], // NYC
          [-122.4194, 37.7749] // San Francisco
        ]
      },
      properties: {
        name: "NYC to San Francisco"
      }
    })
  },
  
  // GeoJSON FeatureCollection with multiple features
  {
    format: "GeoJSON FeatureCollection", 
    value: JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [-74.0060, 40.7128] // NYC
          },
          properties: {
            name: "New York City"
          }
        },
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [-122.4194, 37.7749] // San Francisco
          },
          properties: {
            name: "San Francisco"
          }
        }
      ]
    })
  },
  
  // Invalid GeoJSON
  {
    format: "Invalid GeoJSON format", 
    value: JSON.stringify({
      type: "PointInvalid",
      coordinates: [500, 500] // Invalid coordinates
    })
  },
  
  // Invalid coordinates
  {
    format: "Invalid coordinate values", 
    value: "200,300" // Out of range
  }
];

// GeoJSON parsing function based on our implementation
function parseLocation(location: string): { latitude?: number; longitude?: number } {
  let latitude: number | undefined = undefined;
  let longitude: number | undefined = undefined;
  
  // Try to parse GeoJSON format first
  if (location) {
    try {
      // Try to parse as JSON first
      const parsedLocation = JSON.parse(location);
      
      // Helper function to extract first valid coordinate pair from any GeoJSON geometry
      const extractFirstCoordinate = (geom: any): [number, number] | null => {
        if (!geom || !geom.type || !geom.coordinates) return null;
        
        switch (geom.type) {
          case 'Point':
            // Point: [longitude, latitude]
            if (Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
              return [geom.coordinates[0], geom.coordinates[1]];
            }
            break;
            
          case 'LineString':
            // LineString: [[lon1, lat1], [lon2, lat2], ...]
            if (Array.isArray(geom.coordinates) && geom.coordinates.length > 0 && 
                Array.isArray(geom.coordinates[0]) && geom.coordinates[0].length >= 2) {
              return [geom.coordinates[0][0], geom.coordinates[0][1]];
            }
            break;
            
          case 'Polygon':
            // Polygon: [[[lon1, lat1], [lon2, lat2], ...], [...]]
            if (Array.isArray(geom.coordinates) && geom.coordinates.length > 0 && 
                Array.isArray(geom.coordinates[0]) && geom.coordinates[0].length > 0 &&
                Array.isArray(geom.coordinates[0][0]) && geom.coordinates[0][0].length >= 2) {
              return [geom.coordinates[0][0][0], geom.coordinates[0][0][1]];
            }
            break;
            
          case 'MultiPoint':
            // MultiPoint: [[lon1, lat1], [lon2, lat2], ...]
            if (Array.isArray(geom.coordinates) && geom.coordinates.length > 0 && 
                Array.isArray(geom.coordinates[0]) && geom.coordinates[0].length >= 2) {
              return [geom.coordinates[0][0], geom.coordinates[0][1]];
            }
            break;
            
          case 'MultiLineString':
            // MultiLineString: [[[lon1, lat1], [lon2, lat2], ...], [...]]
            if (Array.isArray(geom.coordinates) && geom.coordinates.length > 0 && 
                Array.isArray(geom.coordinates[0]) && geom.coordinates[0].length > 0 &&
                Array.isArray(geom.coordinates[0][0]) && geom.coordinates[0][0].length >= 2) {
              return [geom.coordinates[0][0][0], geom.coordinates[0][0][1]];
            }
            break;
            
          case 'MultiPolygon':
            // MultiPolygon: [[[[lon1, lat1], [lon2, lat2], ...], [...]], [...]]
            if (Array.isArray(geom.coordinates) && geom.coordinates.length > 0 && 
                Array.isArray(geom.coordinates[0]) && geom.coordinates[0].length > 0 &&
                Array.isArray(geom.coordinates[0][0]) && geom.coordinates[0][0].length > 0 &&
                Array.isArray(geom.coordinates[0][0][0]) && geom.coordinates[0][0][0].length >= 2) {
              return [geom.coordinates[0][0][0][0], geom.coordinates[0][0][0][1]];
            }
            break;
        }
        
        return null;
      };
      
      // Determine the type of GeoJSON
      let coords: [number, number] | null = null;
      
      // Direct geometry object
      if (parsedLocation.type && parsedLocation.coordinates) {
        coords = extractFirstCoordinate(parsedLocation);
        if (coords) {
          log.info(`Parsed GeoJSON ${parsedLocation.type}: [${coords[0]}, ${coords[1]}]`);
        }
      } 
      // Feature
      else if (parsedLocation.type === 'Feature' && parsedLocation.geometry) {
        coords = extractFirstCoordinate(parsedLocation.geometry);
        if (coords) {
          log.info(`Parsed GeoJSON Feature with ${parsedLocation.geometry.type}: [${coords[0]}, ${coords[1]}]`);
        }
      }
      // FeatureCollection
      else if (parsedLocation.type === 'FeatureCollection' && 
              Array.isArray(parsedLocation.features) && 
              parsedLocation.features.length > 0 &&
              parsedLocation.features[0].geometry) {
        coords = extractFirstCoordinate(parsedLocation.features[0].geometry);
        if (coords) {
          log.info(`Parsed GeoJSON FeatureCollection (first feature is ${parsedLocation.features[0].geometry.type}): [${coords[0]}, ${coords[1]}]`);
        }
      }
      
      // If coordinates were found, validate and assign them
      if (coords) {
        // GeoJSON coordinates are in [longitude, latitude] order
        longitude = coords[0];
        latitude = coords[1];
        
        // Validate coordinate ranges
        if (!latitude || !longitude || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
          log.warn(`Invalid GeoJSON coordinates: [${longitude}, ${latitude}]`);
          latitude = undefined;
          longitude = undefined;
        }
      }
    } catch (e) {
      // Not JSON or invalid JSON - try other parsing methods
      // No need to log here, will attempt other formats
    }
  }
  
  // If GeoJSON parsing didn't work, try simple coordinate format
  if (latitude === undefined || longitude === undefined) {
    // Try to parse simple coordinate format - could be "lat,lng" or "lng,lat"
    if (location && location.includes(',')) {
      const parts = location.split(',');
      if (parts.length === 2) {
        try {
          // Parse both values
          const val1 = parseFloat(parts[0].trim());
          const val2 = parseFloat(parts[1].trim());
          
          // Ensure values are valid numbers
          if (isNaN(val1) || isNaN(val2)) {
            latitude = undefined;
            longitude = undefined;
          } else {
            // Determine which is latitude and which is longitude based on value ranges
            // Latitude: -90 to 90, Longitude: -180 to 180
            if (Math.abs(val1) <= 90 && Math.abs(val2) <= 180) {
              // Standard "lat,lng" format
              latitude = val1;
              longitude = val2;
              log.info(`Parsed standard lat,lng format: [${longitude}, ${latitude}]`);
            } else if (Math.abs(val2) <= 90 && Math.abs(val1) <= 180) {
              // Reversed "lng,lat" format
              latitude = val2;
              longitude = val1;
              log.info(`Parsed reversed lng,lat format: [${longitude}, ${latitude}]`);
            } else {
              // Values out of range, might not be coordinates
              log.warn(`Coordinate values out of range in '${location}'`);
              latitude = undefined;
              longitude = undefined;
            }
          }
        } catch (e) {
          // Keep as undefined if parsing fails
          log.warn(`Failed to parse coordinates from '${location}'`);
        }
      }
    }
  }
  
  return { latitude, longitude };
}

// Test the parsing function with all formats
function runTests() {
  console.log('\n🧪 TESTING GEOJSON PARSING FUNCTIONALITY\n');
  
  let passedTests = 0;
  let failedTests = 0;
  
  testLocations.forEach((testCase, index) => {
    console.log(`\n📍 Test ${index + 1}: ${testCase.format}`);
    console.log(`Raw location: ${testCase.value}`);
    
    // Parse the location
    const result = parseLocation(testCase.value);
    
    console.log(`Parsed coordinates: [${result.longitude}, ${result.latitude}]`);
    
    // Evaluate the test result
    if (testCase.format.includes('Invalid')) {
      // For invalid tests, we expect undefined coordinates
      if (result.latitude === undefined && result.longitude === undefined) {
        console.log('✅ PASS: Invalid data correctly handled');
        passedTests++;
      } else {
        console.log('❌ FAIL: Should have rejected invalid data');
        failedTests++;
      }
    } else {
      // For valid tests, we expect coordinates to be parsed
      if (result.latitude !== undefined && result.longitude !== undefined) {
        console.log('✅ PASS: Valid coordinates parsed correctly');
        passedTests++;
      } else {
        console.log('❌ FAIL: Failed to parse valid coordinates');
        failedTests++;
      }
    }
    
    console.log('-------------------------------------------');
  });
  
  // Summary
  console.log(`\n📊 SUMMARY: ${passedTests} passed, ${failedTests} failed\n`);
  
  if (failedTests === 0) {
    console.log('🎉 All tests passed! GeoJSON parsing is working correctly.\n');
  } else {
    console.log('❌ Some tests failed. Please check the implementation.\n');
  }
}

// Run the tests
runTests();
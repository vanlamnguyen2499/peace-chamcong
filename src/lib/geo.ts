/**
 * Calculate distance between two coordinates in meters using Haversine formula
 */
export function calculateDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return Math.round(distance * 10) / 10; // Round to 1 decimal place (meters)
}

/**
 * Check if coordinate is within branch radius
 */
export function isWithinBranchRadius(
  userLat: number,
  userLng: number,
  branchLat: number,
  branchLng: number,
  radiusMeters: number
): { isInside: boolean; distance: number } {
  const distance = calculateDistanceInMeters(userLat, userLng, branchLat, branchLng);
  return {
    isInside: distance <= radiusMeters,
    distance,
  };
}

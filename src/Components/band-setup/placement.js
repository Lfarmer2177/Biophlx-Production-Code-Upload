// Placement follows the hardware exercise types, not a guessed muscle-name match.
export function placementForType(type) {
  if (type >= 0 && type <= 5) return 'arms';
  if (type >= 6 && type <= 10) return 'legs';
  if (type >= 11 && type <= 13) return 'combined';
  return null;
}

export function placementSlots(placement, side = 'right') {
  if (placement === 'arms') return [{ limb: 0, side: 0 }, { limb: 0, side: 1 }];
  if (placement === 'legs') return [{ limb: 1, side: 0 }, { limb: 1, side: 1 }];
  if (placement === 'combined') return [{ limb: 1, side: side === 'left' ? 0 : 1 }, { limb: 0, side: side === 'left' ? 0 : 1 }];
  return null;
}

export const placementCopy = {
  arms: 'Place band 1 on your left biceps and band 2 on your right biceps. Keep the sensor visible on the front of each upper arm.',
  legs: 'Place band 1 on your left thigh and band 2 on your right thigh, with both sensors facing forward.',
  combined: 'Place band 1 on your thigh and band 2 on your biceps, with sensors facing forward. Use the side selected below.',
};

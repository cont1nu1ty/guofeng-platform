import { describe, expect, it } from 'vitest'
import { distanceKm } from '../src/pkg-content/domain/venueRegions'
describe('venue distances', () => {
  it('computes bounded great-circle distances and handles the date line', () => {
    expect(distanceKm({latitude: 30, longitude: 120}, {latitude: 30, longitude: 120})).toBe(0)
    expect(distanceKm({latitude: 0, longitude: 0}, {latitude: 0, longitude: 1})).toBeCloseTo(111.195, 2)
    expect(distanceKm({latitude: 0, longitude: 179.9}, {latitude: 0, longitude: -179.9})).toBeCloseTo(22.239, 2)
    expect(distanceKm({latitude: 90, longitude: 0}, {latitude: -90, longitude: 0})).toBeCloseTo(20015.087, 2)
  })
})

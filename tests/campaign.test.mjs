import test from 'node:test';
import assert from 'node:assert/strict';
import { newProfile, newRun, restore, finish, unlocked, xp } from '../src/profile.ts';
import { clipSegment, slide, blocked, steer } from '../src/physics.ts';
import { missions } from '../src/story.ts';

test('eight chapters advance and persist after every checkpoint', () => {
  let p = newProfile();
  for (let index = 0; index < 8; index++) {
    assert.equal(unlocked(p), index);
    const r = newRun(index, 0, 24);
    assert.equal(missions[index].goals.length, 3);
    for (let stage = 0; stage < 3; stage++) {
      r.stage = stage;
      r.optional = true;
      r.seconds = 42;
      p.run = r;
      p = restore(JSON.stringify(p), 1);
      assert.deepEqual(p.run, r);
    }
    r.stage = 3;
    r.rescues = 1;
    finish(p, r);
    p = restore(JSON.stringify(p), 1);
    assert.equal(p.run, null);
  }
  assert.equal(Object.keys(p.results).length, 8);
  assert.equal(xp(p), 1400);
});
test('replaying a mission preserves the best time and prior optional discoveries', () => {
  const p = newProfile(),
    r = newRun(0, 0, 0);
  r.optional = true;
  r.seconds = 50;
  finish(p, r);
  r.optional = false;
  r.seconds = 75;
  finish(p, r);
  assert.equal(p.results[0].optional, true);
  assert.equal(p.results[0].seconds, 50);
});
test('invalid storage and locked chapter saves recover', () => {
  assert.deepEqual(restore('invalid', 0), newProfile(0));
  const p = newProfile();
  p.run = newRun(7, 0, 0);
  assert.equal(restore(JSON.stringify(p), 2).run, null);
  p.run = newRun(0, 1, 2);
  p.run.health = -5;
  p.prefs.sensitivity = 99;
  p.run.defeated = [1, 1, -1];
  const s = restore(JSON.stringify(p), 1);
  assert.equal(s.run.health, 1);
  assert.equal(s.prefs.sensitivity, 2.5);
  assert.deepEqual(s.run.defeated, [1]);
});
const wall = { min: { x: 1, y: -1, z: -2 }, max: { x: 1.3, y: 3, z: 2 } };
test('a swept character stops before thin walls and slides along them', () => {
  const [x, z] = slide(0, 0, 3, 1, 0, 10, [wall]);
  assert.ok(x < 0.67);
  assert.ok(z > 0.99);
  assert.equal(blocked(x, 0, z, 0.34, [wall]), false);
});
test('camera and awareness rays stop at the near expanded wall face', () => {
  const zero = { x: 0, y: 1, z: 0 },
    dst = { x: 4, y: 1, z: 0 };
  assert.ok(clipSegment(zero, dst, [wall], 0.2) < 0.2);
  assert.equal(clipSegment(zero, { x: 0, y: 1, z: 4 }, [wall]), 1);
  assert.equal(clipSegment({ x: 1.2, y: 1, z: 0 }, dst, [wall]), 0);
});
test('NPC steering finds a clear side beside a blocked direction', () => {
  const [x, z] = steer(0.42, 1.95, 4, 1.95, 0, [wall], 1);
  assert.ok(x || z);
  assert.equal(blocked(0.42 + x * 1.05, 0, 1.95 + z * 1.05, 0.35, [wall]), false);
});

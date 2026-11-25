// Exercise complete mission state transitions between rendered frames. The normal
// movement, physics, AI, interactions and save callbacks all run at the fixed step.
export async function testCampaign(page, chunk, base) {
  return page.evaluate(
    async ({ chunk, base }) => {
      const module = await import(base + 'assets/' + chunk);
      const { Game } = module.Game
        ? module
        : Object.values(module).find((value) => value && typeof value.Game === 'function');
      const prefs = {
        quality: 0,
        difficulty: 0,
        sensitivity: 1,
        touchSensitivity: 1,
        keys: {
          up: 'KeyW',
          down: 'KeyS',
          left: 'KeyA',
          right: 'KeyD',
          sprint: 'ShiftLeft',
          jump: 'Space',
        },
        vibrate: false,
      };
      const silent = { fx() {}, speak() {} };
      const results = [];
      for (let index = 0; index < 8; index++) {
        const canvas = document.createElement('canvas');
        let last,
          completed,
          failed = false;
        const game = new Game(canvas, index, null, prefs, silent, {
          save: (r) => (last = structuredClone(r)),
          finish: (r) => (completed = r),
          fail: () => (failed = true),
          notify() {},
          line() {},
          hud() {},
        });
        game.renderer.render = () => {};
        game.start();
        const dt = 1 / 30;
        let steps = 0;
        const advance = () => {
          game.tick(dt);
          steps++;
          if (failed || steps > 7000)
            throw Error('تعذّر إتمام الفصل ' + (index + 1) + ' عند الهدف ' + game.run.stage);
        };
        const move = (target) => {
          for (let j = 0; j < 1200; j++) {
            const dx = target[0] - game.run.x,
              dz = target[1] - game.run.z,
              d = Math.hypot(dx, dz);
            if (d < 1.05) {
              game.joy = { x: 0, y: 0 };
              return;
            }
            if (game.run.health < 45) game.action('heal');
            const yaw = game.run.yaw;
            game.joy = {
              x: (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d,
              y: (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / d,
            };
            advance();
          }
          throw Error('طريق غير قابل للعب في الفصل ' + (index + 1) + ' · ' + game.run.stage);
        };
        if (index > 0) {
          const before = game.run.ammo;
          game.fireHeld = true;
          advance();
          game.fireHeld = false;
          if (game.run.ammo !== before - 1) throw Error('إطلاق');
          game.action('reload');
          for (let j = 0; j < 60; j++) advance();
          if (game.run.ammo !== before) throw Error('تلقيم');
        }
        game.action('jump');
        advance();
        if (game.alt <= 0) throw Error('قفز');
        game.action('crouch');
        for (let j = 0; j < 40; j++) advance();
        game.action('crouch');
        move(game.world.objectives[0]);
        game.action('interact');
        if (last.stage !== 1) throw Error('حفظ الهدف الأول');
        move(game.world.optional);
        game.action('interact');
        if (!last.optional) throw Error('الذكرى');
        move(game.world.objectives[1]);
        game.action('interact');
        if (last.stage !== 2) throw Error('حفظ الهدف الثاني');
        move(game.world.objectives[2]);
        for (let i = 0; i < 150 && !completed; i++) {
          advance();
          if (i % 10 === 0) game.action('interact');
        }
        if (!completed || completed.stage !== 3) throw Error('لم تكتمل مرحلة ' + (index + 1));
        results.push({
          chapter: index + 1,
          checkpoints: completed.stage,
          memory: completed.optional,
          rescued: completed.rescues,
          simulatedSeconds: Math.round(completed.seconds),
        });
        game.dispose();
      }
      return results;
    },
    { chunk, base },
  );
}

import { missions } from './story';
import type { Game } from './game';
import { ar, ico, keyName } from './menu';
import type { Prefs } from './profile';
const get = (id: string) => document.getElementById(id)!;
export function hudShell() {
  return `<div class="mission-hud hud-box"><small id="h-stage"></small><strong id="h-mission"></strong><span id="h-goal"></span></div><aside id="h-memory" class="memory-card" hidden></aside><div class="compass" id="h-compass"></div><div class="map-hud"><canvas id="map" width="210" height="210" aria-label="خريطة الحي"></canvas><button data-go="pause" class="hud-pause" aria-label="إيقاف مؤقت">${ico('pause', 16)}</button></div><div class="vitals hud-box"><div class="health-line">${ico('heart', 15)} الصحة <span id="h-health"></span></div><div class="hpbar"><i id="hpfill"></i></div><small id="h-kit"></small></div><div class="inv hud-box" id="h-inv"></div><div id="h-reticle" class="reticle"></div><div id="h-marker" class="world-goal"><i class="goal-icon"></i><span id="h-distance" class="distance"></span></div><div id="h-prompt" class="interact-hint" hidden></div><div id="h-line" class="subtitle" hidden></div><div class="tutorial" id="h-tutorial"></div><div class="impact" id="h-impact"></div>`;
}
export function hudUpdate(g: Game, p: Prefs) {
  const r = g.run,
    m = missions[r.index],
    goal = m.goals[r.stage];
  if (!goal || !get('h-goal')) return;
  get('h-mission').textContent = m.title;
  get('h-stage').textContent = `الفصل ${ar(r.index + 1)} · الهدف ${ar(r.stage + 1)} من ٣`;
  get('h-goal').textContent = goal.label;
  get('h-compass').textContent = [
    'شمال',
    'شمال غربي',
    'غرب',
    'جنوب غربي',
    'جنوب',
    'جنوب شرقي',
    'شرق',
    'شمال شرقي',
  ][((Math.round(r.yaw / (Math.PI / 4)) % 8) + 8) % 8];
  get('h-health').textContent = ar(r.health);
  get('hpfill').style.transform = 'scaleX(' + r.health / 100 + ')';
  get('h-kit').textContent = 'حقائب الإسعاف · ' + ar(r.kits);
  const inv = get('h-inv');
  inv.innerHTML =
    r.index === 0
      ? `<small>${ico('book-open', 16)} دفتر العائلة</small>`
      : `<small>${g.reloadTime ? 'جارٍ التلقيم' : r.tool ? 'مطلق النبض' : 'بندقية الحارس'}</small><b>${r.ammo} / ${r.reserve}</b>`;
  get('h-reticle').hidden = !r.index;
  get('h-impact').style.opacity = String(g.hurt * 1.4);
  const s = g.goalScreen(),
    mark = get('h-marker'),
    distance = Math.hypot(g.stageProp.position.x - r.x, g.stageProp.position.z - r.z);
  mark.style.left = Math.max(3, Math.min(97, (s.x + 1) * 50)) + '%';
  mark.style.top = Math.max(15, Math.min(88, (1 - s.y) * 50)) + '%';
  mark.hidden = s.z > 1 || s.z < -1;
  get('h-distance').textContent = ar(distance) + ' م';
  const prompt = get('h-prompt');
  prompt.hidden = !g.near;
  prompt.textContent =
    (matchMedia('(pointer:coarse)').matches ? '✋' : keyName(p.keys.interact)) +
    ' · ' +
    (g.near === 'goal' ? goal.action : g.near === 'kit' ? 'جمع المؤن' : m.optional);
  get('h-tutorial').textContent =
    r.seconds < 17
      ? `${[p.keys.up, p.keys.left, p.keys.down, p.keys.right].map(keyName).join(' ')} للحركة  ·  الفأرة للنظر  ·  ${keyName(p.keys.interact)} للتفاعل`
      : '';
  const c = (get('map') as HTMLCanvasElement).getContext('2d');
  if (!c) return;
  const scale = 2.7,
    f = (x: number) => 105 + x * scale;
  c.clearRect(0, 0, 210, 210);
  c.save();
  c.beginPath();
  c.arc(105, 105, 103, 0, Math.PI * 2);
  c.clip();
  c.fillStyle = '#192826';
  c.fillRect(0, 0, 210, 210);
  c.strokeStyle = '#8190832b';
  c.lineWidth = 1;
  for (let i = -35; i <= 35; i += 6) {
    c.beginPath();
    c.moveTo(f(i), 0);
    c.lineTo(f(i), 210);
    c.moveTo(0, f(i));
    c.lineTo(210, f(i));
    c.stroke();
  }
  c.fillStyle = '#7d826f';
  for (const b of g.world.blockers)
    c.fillRect(f(b.min.x), f(b.min.z), (b.max.x - b.min.x) * scale, (b.max.z - b.min.z) * scale);
  function dot(x: number, z: number, color: string, rad: number) {
    c!.fillStyle = color;
    c!.beginPath();
    c!.arc(f(x), f(z), rad, 0, 7);
    c!.fill();
  }
  dot(g.stageProp.position.x, g.stageProp.position.z, '#fcd18a', 5);
  if (!r.optional) dot(...g.world.optional, '#77cab7', 3);
  for (const n of g.enemies)
    if (n.state === 'alert') dot(n.actor.group.position.x, n.actor.group.position.z, '#da8274', 3);
  c.translate(f(r.x), f(r.z));
  c.rotate(-r.yaw);
  c.beginPath();
  c.moveTo(0, -7);
  c.lineTo(5, 6);
  c.lineTo(0, 4);
  c.lineTo(-5, 6);
  c.closePath();
  c.fillStyle = '#faf7e8';
  c.fill();
  c.restore();
}

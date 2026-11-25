import type { Game } from './game';
import type { Profile } from './profile';
import { ico } from './menu';
const controls: Record<string, [string, string, number, number]> = {
  stick: ['الحركة', '', 13, 73],
  fire: ['إطلاق', 'crosshair', 88, 67],
  aim: ['تصويب', 'focus', 92, 44],
  reload: ['تلقيم', 'rotate-ccw', 77, 79],
  jump: ['قفز', 'chevrons-up', 94, 82],
  crouch: ['انحناء', 'shield', 86, 87],
  sprint: ['ركض', 'footsteps', 22, 54],
  interact: ['تفاعل', 'hand', 75, 58],
  heal: ['إسعاف', 'plus', 6, 45],
  weapon: ['تبديل السلاح', 'layers', 83, 38],
};
export function touchControls(
  container: HTMLElement,
  p: Profile,
  current: () => Game | undefined,
  edit: boolean,
  write: () => void,
  done: () => void,
) {
  const g = current();
  container.innerHTML =
    (edit
      ? `<div class="touch-edit-title" dir="rtl"><small>تخصيص التحكم</small><p>اسحب الأزرار إلى مكان مريح لك.</p><button class="gold" id="layout-done">حفظ المواضع</button><button class="plain" id="layout-reset">استعادة التوزيع</button></div>`
      : '') +
    Object.entries(controls)
      .map(([id, [name, icon, x, y]]) => {
        const pos = p.prefs.buttons[id] ?? [x, y];
        return `<button title="${name}" aria-label="${name}" class="${id === 'stick' ? 'joystick' : 'touch-btn'}" data-touch="${id}" style="left:${pos[0]}%;top:${pos[1]}%">${id === 'stick' ? '<i></i>' : ico(icon, 19)}</button>`;
      })
      .join('');
  if (edit) {
    document.querySelector('#layout-done')?.addEventListener('click', () => {
      write();
      done();
    });
    document.querySelector('#layout-reset')?.addEventListener('click', () => {
      p.prefs.buttons = {};
      touchControls(container, p, current, edit, write, done);
    });
  }
  for (const b of container.querySelectorAll<HTMLButtonElement>('[data-touch]')) {
    const id = b.dataset.touch!;
    let pointer: number | null = null;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      if (edit) {
        const x = Math.max(4, Math.min(96, (100 * e.clientX) / innerWidth)),
          y = Math.max(8, Math.min(92, (100 * e.clientY) / innerHeight));
        p.prefs.buttons[id] = [x, y];
        b.style.left = x + '%';
        b.style.top = y + '%';
        return;
      }
      if (id === 'stick' && g) {
        const r = b.getBoundingClientRect(),
          dx = (e.clientX - r.x - r.width / 2) / (r.width * 0.42),
          dy = (e.clientY - r.y - r.height / 2) / (r.height * 0.42),
          len = Math.max(1, Math.hypot(dx, dy));
        g.joy = { x: dx / len, y: dy / len };
        (b.firstElementChild as HTMLElement).style.transform =
          `translate(${g.joy.x * 65}%,${g.joy.y * 65}%)`;
      }
    };
    b.onpointerdown = (e) => {
      if (pointer !== null) return;
      e.preventDefault();
      pointer = e.pointerId;
      b.setPointerCapture(pointer);
      if (edit || !g) return;
      move(e);
      if (id === 'fire') g.fireHeld = true;
      else if (id === 'aim') {
        g.aim = !g.aim;
        b.classList.toggle('on', g.aim);
      } else if (id === 'sprint') {
        g.touchSprint = !g.touchSprint;
        b.classList.toggle('on', g.touchSprint);
      } else g.action(id);
    };
    b.onpointermove = move;
    b.onlostpointercapture =
      b.onpointercancel =
      b.onpointerup =
        (e) => {
          if (e.pointerId !== pointer) return;
          pointer = null;
          if (!g || edit) return;
          if (id === 'stick') {
            g.joy = { x: 0, y: 0 };
            (b.firstElementChild as HTMLElement).style.transform = '';
          }
          if (id === 'fire') g.fireHeld = false;
        };
  }
}

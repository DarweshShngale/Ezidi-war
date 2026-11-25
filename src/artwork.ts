// A photographic relief scene for the title. Depth varies across the mountain,
// foreground figure and sky. The pointer moves the viewpoint within a small orbit.
export function titleScene(canvas: HTMLCanvasElement, src: string) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'low-power' });
  if (!gl) return () => {};
  const vs = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const fs = `precision mediump float; varying vec2 uv;uniform sampler2D tex;uniform vec2 size,look;uniform float t;
 void main(){vec2 u=uv;float aspect=size.x/size.y;float photo=1.777;vec2 fit=vec2(min(1.,aspect/photo),min(1.,photo/aspect));
 u=(u-.5)*fit+vec2(aspect<.85?.40:.5,.5);float ridge=1.-smoothstep(.22,.76,u.y);
 float figure=(1.-smoothstep(.2,.275,abs(u.x-.186)))*(1.-smoothstep(.47,.885,u.y));
 float depth=.18+.32*ridge+.46*figure;u+=(look+vec2(sin(t*.095)*.23,cos(t*.07)*.09))*.006*depth;
 vec3 c=texture2D(tex,clamp(u,0.001,.999)).rgb;
 for(int i=0;i<12;i++){float n=float(i);vec2 q=fract(vec2(n*.6727+t*(.005+n*.0005),n*.2721+t*(.004+n*.0003)));vec2 v=(uv-q)*vec2(aspect,1.);float g=exp(-dot(v,v)*(.26e6+n*1.e4));c+=vec3(.54,.35,.15)*g*(.23+.19*sin(t+n));}
 gl_FragColor=vec4(c,1.);}`;
  function shader(type: number, src: string) {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    return s;
  }
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vs));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return () => {};
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const pos = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  for (const d of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T])
    gl.texParameteri(gl.TEXTURE_2D, d, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const size = gl.getUniformLocation(program, 'size'),
    look = gl.getUniformLocation(program, 'look'),
    time = gl.getUniformLocation(program, 't');
  let dx = 0,
    dy = 0,
    x = 0,
    y = 0,
    last = 0,
    ok = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.addEventListener(
    'pointermove',
    (e) => {
      if (!reduce) {
        dx = (e.clientX / innerWidth - 0.5) * 2;
        dy = (0.5 - e.clientY / innerHeight) * 2;
      }
    },
    { passive: true },
  );
  const img = new Image();
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    ok = true;
  };
  img.src = src;
  function draw(t: number) {
    if (
      !ok ||
      document.hidden ||
      document.body.dataset.mode !== 'home' ||
      t - last < (reduce ? 300 : 45)
    )
      return;
    last = t;
    const width = Math.min(innerWidth, 1700),
      height = Math.round((width * innerHeight) / innerWidth);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl!.viewport(0, 0, width, height);
    }
    x += (dx - x) * 0.04;
    y += (dy - y) * 0.04;
    gl!.uniform2f(size, width, height);
    gl!.uniform2f(look, x, y);
    gl!.uniform1f(time, reduce ? 0 : t * 0.001);
    gl!.drawArrays(gl!.TRIANGLES, 0, 6);
  }
  return draw;
}

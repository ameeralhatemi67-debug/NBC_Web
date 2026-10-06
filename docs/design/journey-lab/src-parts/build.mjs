import fs from 'node:fs';
const r = (f) => fs.readFileSync(f, 'utf8');
let data = r('03-data.js');
data = data.replace(/@@img:([a-z_]+)@@/g, (_, n) => 'data:image/jpeg;base64,' + fs.readFileSync(`../screenshots/${n}.jpg`).toString('base64'));
const fonts = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&family=Noto+Naskh+Arabic:wght@400;700&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap';
const out = `<title>NBC Journey Lab</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>
${r('01-style.css')}
</style>
${r('02-body.html')}
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
${data}
${r('04-book3d.js')}
${r('05-proto.js')}
${r('06-admin.js')}
${r('07-shell.js')}
</script>
`;
fs.writeFileSync('../nbc-journey-lab.html', out);
console.log('bytes', out.length);

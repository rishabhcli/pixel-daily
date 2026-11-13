// Hand-drawn pixel pictures for Pixel Daily. Every picture was drawn for this project.
//
// Format: blocks separated by a blank line. First line is the name, the rest are rows.
// Palette keys are in core.ts (PALETTE); '.' is an empty cell.
// A row ending in '|' is a left half that is mirrored (even width).
// A row ending in '/' is a left half including the centre column that is mirrored (odd width).
// A row with neither marker is written out in full.
import type { Picture } from './core.ts';

const SOURCE = `
Heart
.r./
rrr/
rrr/
.rr/
..r/

Mushroom
.rr/
rwr/
rrr/
.tt/
.tt/

Gem
.bb/
bwc/
bcc/
.bc/
..b/

Cat
k../
kkk/
kwk/
kkp/
.kk/

Pine Tree
..d/
.dd/
ddd/
..n/
..n/

Ghost
.ww/
wkw/
www/
www/
w.w/

Apple
..g/
.rr/
rrr/
rrr/
.r./

Sun
.yy/
yky/
yyy/
ykk/
.yy/

Star
..y/
.yy/
yyy/
.yy/
.y./

Cactus
..g/
g.g/
ggg/
..g/
.tt/

Crown
y.y/
yyy/
yry/
yyy/
nnn/

House
..r/
.rr/
rrr/
nnw/
nnw/

Rocket
...w/
..ww/
..wc/
..wc/
.rww/
rr.o/
...y/

Pumpkin
...n/
.ooo/
oooo/
okoo/
ookk/
oooo/
.ooo/

Owl
n.../
nnn./
nwwn/
nwkn/
nnoo/
nttt/
..o./

Bunny
.w../
.w../
.www/
wkww/
wwwp/
.www/
..ww/

Flower
.m.m/
mmmm/
.myy/
mmyy/
.mmm/
...g/
..gg/

Ladybug
..kk/
.rrk/
rkrk/
rrrk/
rkrk/
.rrk/
..kk/

Frog
gg../
gkg./
gggg/
gggg/
gwww/
gwww/
ggg./

Cupcake
...r/
.mmm/
mmmm/
tttt/
.bwb/
.bwb/
..bb/

Bell
...y/
..yy/
.yyy/
.yyy/
.yyy/
yyyy/
...o/

Penguin
..kk/
.kkk/
.kwk/
kkko/
kwww/
kwww/
.oo./

Skull
.www/
wwww/
wkkw/
wkkw/
wwwk/
.wkw/
.w.w/

UFO
..cc/
.cwc/
ssss/
ysys/
.sss/
..yy/
.yyy/

Tulip
r..r/
rrrr/
rrrr/
.rrr/
..rr/
..gg/
...g/

Snowman
..kk/
.kkk/
.wkw/
.wwo/
..ww/
wwwk/
.www/

Umbrella
..rr/
.rrr/
rwrr/
rrrr/
r.rr/
...n/
..nn/

Alien
..g.|
...g|
..gg|
.gkg|
gggg|
g.gg|
g.g.|
...g|

Robot
...y|
.sss|
.sbs|
.sss|
..aa|
ssrs|
ssss|
.aa.|

Panda
kk..|
kwww|
.www|
wkkw|
wwwk|
wwkw|
.www|
..ww|

Fox
oo..|
ooo.|
oooo|
okoo|
owww|
.www|
..ww|
...k|

Pig
pp..|
pppp|
pkpp|
pppp|
.mmm|
.mkm|
.mmm|
..pp|

Bee
..k.|
..yy|
.yky|
wyyy|
wkkk|
.yyy|
..kk|
...k|

Cherries
...g|
..n.|
.n..|
nrr.|
rrrr|
rwrr|
rrrr|
.rr.|

Ice Cream
..pp|
.ppp|
pppp|
mmmm|
.ttt|
..tt|
...t|
...t|

Potion
..nn|
..ww|
..ww|
.www|
wppp|
wpcp|
wppp|
.www|

Lightbulb
..yy|
.yyy|
yyyy|
yyyy|
.yyy|
..ss|
..aa|
...a|

Shield
bbbb|
bbyy|
yyyy|
bbyy|
.byy|
.bbb|
..bb|
...b|

Anchor
...a|
...a|
.aaa|
...a|
...a|
a..a|
aa.a|
.aaa|

Present
.rr.|
..rr|
bbyy|
bbyy|
yyyy|
bbyy|
bbyy|
bbyy|

Butterfly
..k.|
pp.k|
pppk|
pwpk|
.ppk|
mmmk|
.mmk|
..m.|

Burger
..nnn|
.nnnn|
nwnnn|
nnnnn|
ggggg|
rrrrr|
kkkkk|
yyyyy|
nnnnn|
.nnnn|

Pizza Slice
nnnnn|
.yyyy|
.yryy|
..yyy|
..yyr|
...yy|
...yy|
....y|
....y|
....r|

Cake
..y.y|
..w.w|
.mmmm|
mmmmm|
wwwww|
ppppp|
ppppp|
bbbbb|
....t|
..ttt|

Castle
....r|
....a|
s.s.s|
sssss|
sbsss|
sssss|
ssss.|
ssss.|
ssss.|
ssss.|

Spider
k.k..|
.k.kk|
..kkk|
k.kkk|
..krk|
..kkk|
k.kkk|
.k.kk|
k..k.|
k....|

Crab
rr...|
r.r..|
.r.rr|
..rrr|
..rkr|
.rrrr|
..rrr|
.r.r.|
r.r..|
r....|

Tree
....g|
...gg|
..ggg|
.gggg|
..ggg|
.gggg|
ggggg|
....n|
....n|
...nn|

Strawberry
..g.g|
.gggg|
.rrrr|
rrwrr|
rrrrr|
.rwrr|
.rrrr|
..rrr|
...rr|
....r|

Pineapple
...g.|
..ggg|
...gg|
.yyyy|
yoyyy|
yyoyy|
yoyyy|
.yyyy|
.yoyy|
..yyy|

Treasure Chest
..nnn|
.nnnn|
nnnnn|
nnnnn|
yyyyy|
nnnnk|
nnnnn|
nnnnn|
nnnnn|
uuuuu|

Rocket Ship
....w|
...ww|
...wc|
..wcc|
..wcc|
..www|
rrwww|
rr.ww|
r..oo|
...yy|

Teddy Bear
nn...|
nnnnn|
.nnnn|
.nknn|
.nntt|
.nntk|
..nnn|
.nnnn|
.nttt|
.nn..|

Sword
....s|
....s|
....s|
....s|
....s|
....s|
nnnnn|
....n|
....n|
...yy|

Cat Face
kk...|
kkkk.|
kkkkk|
kkkkk|
kgkkk|
kkkkp|
kkkkk|
.kkkk|
..kkk|
...kk|

Lighthouse
....r|
...yy|
...rr|
...ww|
..www|
..rrr|
..www|
..rrr|
.wwww|
.uuuu|

Octopus
..ppp|
.pppp|
ppppp|
pwkpp|
ppppp|
ppppp|
pp.pp|
p.p.p|
p.p.p|
p.p.p|

Big Heart
.rrr.|
rrrrr|
rwrrr|
rrrrr|
rrrrr|
.rrrr|
..rrr|
...rr|
...rr|
....r|

Diamond
....b|
...bw|
..bwc|
.bwcc|
bwccc|
bbccc|
.bccc|
..bcc|
...bc|
....b|

Balloon
..rrr|
.rwrr|
rrwrr|
rrwrr|
.rwrr|
..rrr|
....u|
...nn|
...nn|
...nn|

Bat
k...k|
kk.kk|
kkkkk|
kkwkk|
kkkkk|
k.kkk|
..kkk|
...kk|
....k|
....k|

Sunflower
....yy|
.yy.yy|
.yyyyy|
..yuuu|
yyuuuu|
.yuuuu|
.yuuuu|
yyuuuu|
..yuuu|
.yyyyy|
....gg|
...ggg|

Jellyfish
...ppp|
..pppp|
.ppppp|
.pkppp|
pppppp|
pppppp|
p.p.p.|
p.p.p.|
p.p.p.|
p.p.p.|
p...p.|
p...p.|

Alien Head
....gg|
...ggg|
..gggg|
.ggggg|
.gkkgg|
gkkggg|
gggggg|
.ggggg|
..gggg|
...ggg|
....gg|
.....g|

Fox Face
ooo...|
oooo..|
ooooo.|
oooooo|
oooooo|
ookooo|
owwwoo|
.wwwww|
..wwww|
...www|
....ww|
.....k|

Owl Perch
n.....|
nn....|
nnnnn.|
nnnnnn|
nwwwnn|
nwkwnn|
nwwwnn|
nnnnno|
nnnttt|
nnnttt|
.nnttt|
..oo..|

Toadstool
...rrr|
..rrrr|
.rwwrr|
rrwwrr|
rrrrrr|
rrrrrr|
...ttt|
...ttt|
...ttt|
...ttt|
..tttt|
..tttt|

Haunt
...www|
..wwww|
.wwwww|
.wkkww|
.wkkww|
wwwwww|
wwwwkk|
wwwwkk|
wwwwww|
wwwwww|
wwwwww|
ww.ww.|

Penguin Chick
...kkk|
..kkkk|
.kwkkk|
.kkkoo|
kkkwww|
kkwwww|
kkwwww|
kkwwww|
kkwwww|
.kwwww|
.kkwww|
..ooo.|

Space Rocket
.....w|
....ww|
...www|
...wcc|
...wcc|
...www|
...www|
..rwww|
.rrwww|
rrrwww|
rr..oo|
....yy|

Sunburst Flower
.....y|
.y..yy|
..yyyy|
yyyuuu|
.yuuuu|
yyuuuu|
yyuuuu|
.yuuuu|
yyyuuu|
..yyyy|
.y..yy|
.....y|

Heart Big
.rrrr...|
rrrrrr..|
rwwrrrrr|
rwrrrrrr|
rrrrrrrr|
rrrrrrrr|
rrrrrrrr|
.rrrrrrr|
..rrrrrr|
...rrrrr|
....rrrr|
.....rrr|
......rr|
.......r|
.......r|

Pine Tall
.......g|
......gg|
.....ggg|
....gggg|
......gg|
.....ggg|
....gggg|
...ggggg|
.....ggg|
....gggg|
...ggggg|
..gggggg|
......nn|
......nn|
......nn|

Skull Big
...wwwww|
..wwwwww|
.wwwwwww|
.wwwwwww|
.wwkkkww|
.wwkkkww|
.wwkkkww|
.wwwwwwk|
..wwwwkk|
...wwwww|
...w.w.w|
...w.w.w|
...w.w.w|
...w.w.w|
...wwwww|

Cupcake Big
.......r|
......rr|
....mmmm|
...mmmmm|
..mmmmmm|
.mmmmmmm|
wwwwwwww|
.bwbwbwb|
.bwbwbwb|
..bwbwbw|
..bwbwbw|
...bwbwb|
...bwbwb|
...bwbwb|
....bwbw|

Rocket Tall
.......w|
......ww|
.....www|
.....www|
.....wcc|
.....wcc|
.....www|
.....www|
....wwww|
...rwwww|
..rrwwww|
.rrrwwww|
.rr..www|
.....ooo|
......yy|

Mushroom Big
....rrrr|
..rrrrrr|
.rrrrrrr|
.rwwrrrr|
rrwwrrrr|
rrrrrrrr|
rrrrrwwr|
rrrrrrrr|
.ttttttt|
.....ttt|
.....ttt|
.....ttt|
.....ttt|
....tttt|
....tttt|

Bell Big
.......y|
......yy|
.....yyy|
....yyyy|
....yyyy|
...yyyyy|
...yyyyy|
...yyyyy|
..yyyyyy|
..yyyyyy|
.yyyyyyy|
.yyyyyyy|
yyyyyyyy|
yyyyyyyy|
......oo|

Gem Big
.......b|
......bw|
.....bww|
....bwcc|
...bwccc|
..bwcccc|
.bwccccc|
bbwccccc|
.bbccccc|
..bbcccc|
...bbccc|
....bbcc|
.....bbc|
......bb|
.......b|
`;

function expand(line: string): string {
  if (line.endsWith('|')) {
    const s = line.slice(0, -1);
    return s + [...s].reverse().join('');
  }
  if (line.endsWith('/')) {
    const s = line.slice(0, -1);
    return s + [...s.slice(0, -1)].reverse().join('');
  }
  return line;
}

/** Heart Big etc. were written with a trailing '|' meaning "left half including centre": handled by size. */
export function parseCatalog(src: string): Picture[] {
  const out: Picture[] = [];
  for (const block of src.trim().split(/\n\s*\n/)) {
    const lines = block.split('\n').map((l) => l.trim());
    const name = lines[0]!;
    const raw = lines.slice(1);
    const size = raw.length;
    const rows = raw.map((l) => {
      // Odd sizes use '/' (centre included). Allow '|' on odd-size rows as "same as '/'" for the 15x15 set.
      if (size % 2 === 1 && l.endsWith('|')) return expand(l.slice(0, -1) + '/');
      return expand(l);
    });
    out.push({ id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${size}`, name, size, rows });
  }
  return out;
}

export const CATALOG: Picture[] = parseCatalog(SOURCE);

#!/usr/bin/python3

import ulvl
import sys

if len(sys.argv) < 2:
    print("usage:", sys.argv[0], "<infiles>")
    sys.exit(1)

screenwidth, screenheight = 9, 9

tilemapping = { 3: 1, 4: 2, 5: 3, 6: 3, 7: 3, 8: 1, 9: 2, 10: 3, 11: 4 }

objmapping = { }

print("var levels={")
for filename in sys.argv[1:]:
    m = ulvl.TMX.load(filename)

    w = m.meta['width']
    h = m.meta['height']

    print('\t', filename.replace('.tmx', '').replace('levels/', ''), end=': { ')

    hares = [ ]
    grass = [ ]

    print('map: [', end='')
    for y in range(h):
        for x in range(w):
            thing = m.layers[0].tiles[y * w + x] - 1
            if thing == 3 or thing == 6:
                hares.append({ 'x': x, 'y': y, 'color': 'brown' })
            elif thing == 4 or thing == 7:
                hares.append({ 'x': x, 'y': y, 'color': 'white' })
            elif thing == 8 or thing == 9 or thing == 10:
                grass.append({ 'x': x, 'y': y })

            print("" + str(tilemapping.get(thing, thing)) + ",", end='')
    print('],', end='');

    print('hares: [', end='')
    for h in hares:
        print('{ x:' + str(h['x']) + ', y:' + str(h['y']) + ', color: "' + h['color'] + '" }, ', end='')
    print('],', end='')

    print('grass: [', end='')
    for g in grass:
        print('{ x:' + str(g['x']) + ', y:' + str(g['y']) + ' }, ', end='')
    print('],', end='')

    print(' },')

print("}")

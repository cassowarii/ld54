"use strict";

let game;

let game_started = false;

let level_number = 1;
let intitle = true;
let inend = false;

let map;

/* state:
 * STAND: waiting for input
 * DRAG: dragging hare path
 * HOPDIR: thinking about where to hop
 * HOP: hop animation
 * WIN: won level
 */
let State = { STAND: 0, DRAG: 1, HOPDIR: 2, HOP: 3, WIN: 4 };

let save_data = 1;
const SAVE_KEY = "casso.haregame.save";

zb.ready(function() {
    game = zb.create_game({
        canvas: 'canvas',
        canvas_w: 648,
        canvas_h: 720,
        draw_scale: 3,
        tile_size: 24,
        level_w: 9,
        level_h: 9,
        background_color: 'black',
        draw_func: do_draw,
        update_func: do_update,
        run_in_background: true,
        //save_key: SAVE_KEY,
        state: State.STAND,
        events: {
            keydown: handle_keydown,
            keyup: handle_keyup,
            mouseup: handle_mouseup,
            mousedown: handle_mousedown,
            mousemove: handle_mousemove,
            mouseleave: handle_mouseleave,
            gamestart: handle_gamestart,
        },
    });

    game.buttons = {
        undo: {
            id: 0,
            state: 0,
            x: game.screen_w - 40,
            y: -20,
            w: 16,
            h: 16,
            callback: undo,
        },
        reset: {
            id: 1,
            state: 0,
            x: game.screen_w - 20,
            y: -20,
            w: 16,
            h: 16,
            callback: reset,
        },
    };

    game.register_sfx({
        jump: {
            path: 'sfx/jump.mp3',
            volume: 0.4,
        },
        push: {
            path: 'sfx/push.mp3',
            volume: 0.1,
        },
        whew: {
            path: 'sfx/whew.mp3',
            volume: 1,
        },
        cronch: {
            path: 'sfx/cronch.mp3',
            volume: 1,
        },
        alert_sound: {
            path: 'sfx/alert.mp3',
            volume: 0.8,
        },
        youwon: {
            path: 'sfx/haregameyouwon.mp3',
            volume: 0.2,
        },
    });

    game.register_images({
        selector: 'img/selector.png',
        hare_white: 'img/rabbitswhite.png',
        hare_brown: 'img/rabbitsbrown.png',
        ground_tile: 'img/ground_tile.png',
        water_tile: 'img/water_tile.png',
        snow_tile: 'img/snow_tile.png',
        patchy_tile: 'img/patchy_tile.png',
        sign_tile: 'img/sign_tile.png',
        frontgrass: 'img/frontgrass.png',
        backgrass: 'img/backgrass.png',
        welldone: 'img/welldone.png',
        clicktocontinue: 'img/clicktocontinue.png',
        title: 'img/title.png',
        end: 'img/end.png',
        buttons: 'img/buttons.png',
        level: {
            1: 'img/level/1.png',
            2: 'img/level/2.png',
            3: 'img/level/3.png',
            4: 'img/level/4.png',
            5: 'img/level/5.png',
            6: 'img/level/6.png',
            7: 'img/level/7.png',
            8: 'img/level/8.png',
            9: 'img/level/9.png',
            10: 'img/level/10.png',
        }
    });

    game.register_music({
        song: {
            path: 'music/haregamesong',
            volume: 0.2,
        },
        nervous: {
            path: 'sfx/nervous',
            volume: 0.6,
        },
    });

    game.resources_ready();
});

/* ---- constants ---- */

let TOP_BAR_SIZE = 24; /* height of top bar */

let CURSOR_CHANGE_SPEED = 300;
let WATER_CHANGE_SPEED = 1000;

let HARE_LAST_HOP_FRAME = 5; /* index of last frame before hop ends */
let HARE_OFFSET = 3; /* hare vertical offset from tile */
let HARE_STAND_FRAME_LENGTH = 50; /* frames when standing to anxious state */
let HARE_QUIVER_FRAME_LENGTH = 100; /* frame length for nervous animation */
let HARE_SIT_FRAME_LENGTH = 100; /* frames when sitting from anxious state */

let GRASS_OFFSET = 2; /* how much draw grass up from grid ?? */

let Tile = {
    WATER: 0,
    GROUND: 1,
    SNOW: 2,
    PATCHY: 3,
    SIGN: 4,
}

let HareType = {
    WHITE: 0,
    BROWN: 1,
}

let Dir = {
    DOWN: 0,
    LEFT: 1,
    RIGHT: 2,
    UP: 3,
}

/* ---- global state vars ---- */

let mouse_x = null, mouse_y = null;

let selector = {
    x: null,
    y: null,
    frame: 0,
    timer: 0,
};

let path = [];
let path_extra = [];

let hares = [];
let grass = [];
let backgrass = [];

let hop_target = null;
let hop_frame_length = 100;

let push_fraction = 0; /* for calculation of how far we've pushed our friend */

let water = {
    frame: 0,
    timer: 0,
}

let win_title_offset;
let ctc_alpha;

let playing_anxious_sound = false;

/* ---- random convenience funcs ---- */

function delete_save() {
    try {
        // delete save
    } catch (e) {
        console.error("oops, can't save! though that uh... doesn't matter here");
    }
}

function save() {
    try {
        // save
    } catch (e) {
        console.error("oops, can't save!", e);
    }
}

function handle_gamestart(game) {
    console.log("Game start!");

    game.music.song.play();

    // initialize game
    load_level_data(levels.title);
}

let undo_stack = [];

function create_undo_point() {
    let undo_point = {};

    undo_point.hares = zb.copy_flat_objlist(hares);
    undo_point.grass = zb.copy_flat_objlist(grass);

    undo_stack.push(undo_point);
}

function undo() {
    // perform undo
    if (undo_stack.length) {
        let state = undo_stack.pop();

        hares = state.hares;
        grass = state.grass;
        backgrass = [];
        for (let g of state.grass) {
            backgrass.push({
                is_backgrass: true,
                x: g.x,
                y: g.y,
                eaten: g.eaten,
            });
        }

        game.state = State.STAND;
        path = [];
        path_extra = [];
        update_selector(mouse_x, mouse_y);
    }
}

function reset() {
    game.start_transition(zb.transition.FADE, 500, function() {
        load_level();
        game.state = State.STAND;
    });
}

function advance_level() {
    if (level_number === 10) {
        win_everything();
    } else {
        game.long_transition(zb.transition.FADE, 350, function() {
            undo_stack = [];
            level_number ++;
            load_level();
            game.state = State.STAND;
        });
    }
}

function win_everything() {
    game.long_transition(zb.transition.FADE, 1000, function() {
        inend = true;
        load_level_data(levels.end);
    });
}

function load_level() {
    if (level_number > Object.keys(levels).length) {
        win_everything();
    } else {
        console.log(levels);
        console.log(level_number);
        console.log(levels[level_number]);
        load_level_data(levels[level_number]);
    }
}

function load_level_data(lvl) {
    game.state = State.STAND;

    map = lvl.map;
    console.log("map:", map);

    path = [];
    path_extra = [];

    hares = [];
    for (let h of lvl.hares) {
        create_hare(h.x, h.y, h.color === 'brown' ? HareType.BROWN : HareType.WHITE);
    }

    grass = [];
    backgrass = [];
    for (let g of lvl.grass) {
        create_grass(g.x, g.y);
    }
}

function create_hare(x, y, type) {
    hares.push({
        is_hare: true,
        x: x,
        y: y,
        type: type,
        dir: Dir.DOWN,
        frame: 0,
        timer: 0,
    });
}

function create_grass(x, y) {
    grass.push({
        is_grass: true,
        x: x,
        y: y,
        eaten: false,
    });

    backgrass.push({
        is_backgrass: true,
        x: x,
        y: y,
        eaten: false,
    });
}

function hare_matches_tile(hare, tile) {
    return tile === Tile.PATCHY
        || hare_strictly_matches_tile(hare, tile);
}

function hare_strictly_matches_tile(hare, tile) {
    return hare.type === HareType.BROWN && tile === Tile.GROUND
        || hare.type === HareType.WHITE && tile === Tile.SNOW;
}

/* ---- buttons ---- */


/* ---- thing finding funcs ---- */

function tile_at(x, y) {
    if (x < 0 || x >= game.level_w || y < 0 || y >= game.level_h) {
        return Tile.WATER;
    }
    return map[y * game.level_w + x];
}

function hare_at(x, y) {
    let list = hares.filter(h => h.x === x && h.y === y);
    if (list.length) {
        return list[0];
    } else {
        return null;
    }
}

function grass_at(x, y) {
    let frontlist = grass.filter(g => g.x === x && g.y === y);
    let backlist = backgrass.filter(g => g.x === x && g.y === y);
    if (frontlist.length && backlist.length) {
        return { front: frontlist[0], back: backlist[0] };
    } else {
        return null;
    }
}

function can_push_to(x, y) {
    return tile_at(x, y) !== Tile.WATER;
}

/* ---- update ---- */

/* MAIN UPDATE FUNCTION */
function do_update(delta) {
    selector.timer += delta;
    while (selector.timer > CURSOR_CHANGE_SPEED) {
        selector.timer -= CURSOR_CHANGE_SPEED;
        selector.frame ++;
        selector.frame = zb.mod(selector.frame, 2);
    }

    water.timer += delta;
    while (water.timer > WATER_CHANGE_SPEED) {
        water.timer -= WATER_CHANGE_SPEED;
        water.frame ++;
        water.frame = zb.mod(water.frame, 2);
    }

    update_hare_anxiety(delta);

    update_hare_movement(delta);

    if (game.state === State.WIN) {
        if (win_title_offset > 1) {
            win_title_offset /= 1.08;
            ctc_alpha = 0;
        } else {
            win_title_offset = 0;
            if (ctc_alpha < 1) {
                ctc_alpha += delta / 500;
            } else {
                ctc_alpha = 1;
            }
        }
    }
}

function update_hare_movement(delta) {
    if (game.state === State.HOPDIR) {
        push_fraction = 0;
        for (let h of hares) {
            if (h.being_pushed) {
                h.x = h.target_x;
                h.y = h.target_y;
                delete h.target_x;
                delete h.target_y;
            }
            h.being_pushed = false;
        }

        if (path.length > 0) {
            let next = path.shift();
            let dx, dy;
            if (next.x === hop_target.x - 1) {
                hop_target.dir = Dir.LEFT;
                dx = -1; dy = 0;
            } else if (next.x === hop_target.x + 1) {
                hop_target.dir = Dir.RIGHT;
                dx = 1; dy = 0;
            } else if (next.y === hop_target.y - 1) {
                hop_target.dir = Dir.UP;
                dx = 0; dy = -1;
            } else {
                hop_target.dir = Dir.DOWN;
                dx = 0; dy = 1;
            }
            game.state = State.HOP;
            game.sfx.jump.play();
            hop_target.frame = 1;
            hop_target.timer = 0;
            hop_target.target_x = next.x;
            hop_target.target_y = next.y;
            let h = hare_at(next.x, next.y);
            if (h) {
                if (can_push_to(h.x + dx, h.y + dy)) {
                    h.target_x = h.x + dx;
                    h.target_y = h.y + dy;
                    h.being_pushed = true;
                    game.sfx.push.play();
                } else {
                    cancel_move();
                }
            }
        } else {
            cancel_move();
        }
    } else if (game.state === State.HOP) {
        hop_target.timer += delta;
        while (hop_target.timer > hop_frame_length) {
            hop_target.timer -= hop_frame_length;
            hop_target.frame ++;
            push_fraction = (hop_target.frame - hop_target.timer / hop_frame_length) / (HARE_LAST_HOP_FRAME + 1);
            if (hop_target.frame > HARE_LAST_HOP_FRAME) {
                game.state = State.HOPDIR;
                hop_target.frame = 1;
                hop_target.timer = 0;
                hop_target.x = hop_target.target_x;
                hop_target.y = hop_target.target_y;
                if (!hare_matches_tile(hop_target, tile_at(hop_target.x, hop_target.y))) {
                    hop_target.anxiety = true;
                    path = [];
                    path_extra = [];
                } else {
                    /* Eat any grass on the tile */
                    eat_grass(hop_target.x, hop_target.y);
                }
                break;
            }
        }
    }
}

function eat_grass(x, y) {
    let g = grass_at(x, y);
    if (g) {
        if (!g.front.eaten) {
            game.sfx.cronch.play();
        }
        g.front.eaten = true;
        g.back.eaten = true;
    }
    check_victory();
}

function cancel_move() {
    selector.x = null;
    selector.y = null;
    path = [];
    path_extra = [];
    update_selector(mouse_x, mouse_y);
    game.state = State.STAND;
    hop_target.frame = 0;
    hop_target.timer = 0;
}

function update_hare_anxiety(delta) {
    /* Hare Anxiety */
    let any_anxiety = false;
    for (let h of hares) {
        if (hare_matches_tile(h, tile_at(h.x, h.y))) {
            h.anxiety = false;
        } else {
            h.anxiety = true;
            any_anxiety = true;
        }

        if (h.anxiety && h.frame < 7) {
            h.frame = 7;
            game.sfx.alert_sound.play();
        } else if (h.anxiety && h.frame < 10) {
            h.timer += delta;
            while (h.timer > HARE_STAND_FRAME_LENGTH && h.frame < 10) {
                h.timer -= HARE_STAND_FRAME_LENGTH
                h.frame ++;
            }
            if (h.frame === 10) {
                h.timer = 0;
            }
        } else if (h.anxiety) {
            /* alternate between frames 10 and 11 */
            h.timer += delta;
            while (h.timer > HARE_QUIVER_FRAME_LENGTH) {
                h.timer -= HARE_QUIVER_FRAME_LENGTH;
                if (h.frame === 10) {
                    h.frame = 11;
                } else {
                    h.frame = 10;
                }
            }
        } else if (!h.anxiety && h.frame === 10 || h.frame === 11) {
            h.frame = 12;
            h.timer = 0;
            game.sfx.whew.play();
        } else if (!h.anxiety && h.frame > 7) {
            h.timer += delta;
            while (h.timer > HARE_SIT_FRAME_LENGTH) {
                h.timer -= HARE_SIT_FRAME_LENGTH
                h.frame ++;
                if (h.frame > 14) {
                    h.frame = 0;
                    h.timer = 0;
                    eat_grass(h.x, h.y);
                }
            }
        }
    }

    if (any_anxiety && !playing_anxious_sound) {
        game.music.nervous.play();
        playing_anxious_sound = true;
    } else if (!any_anxiety && playing_anxious_sound) {
        game.music.nervous.pause();
        playing_anxious_sound = false;
    }
}

function check_victory() {
    for (let g of grass) {
        if (!g.eaten) {
            return false;
        }
    }

    for (let h of hares) {
        if (!hare_strictly_matches_tile(h, tile_at(h.x, h.y))) {
            return false;
        }
    }

    win();
}

function win() {
    for (let h of hares) {
        h.frame = 0;
    }

    console.log("You won!");
    win_title_offset = game.screen_h;
    game.sfx.youwon.play();
    game.state = State.WIN;
}

/* ---- draw ---- */

/* DRAW */
function do_draw(ctx) {
    ctx.save();
    ctx.translate(0, TOP_BAR_SIZE);

    draw_map(ctx);

    draw_objects(ctx);

    draw_selector(ctx);

    draw_ui(ctx);

    ctx.restore();
}

function rpgmaker_tile_format_thing(x, y, tile_type) {
    let u = tile_at(x, y - 1);
    let d = tile_at(x, y + 1);
    let l = tile_at(x - 1, y);
    let r = tile_at(x + 1, y);
    let ul = tile_at(x - 1, y - 1);
    let ur = tile_at(x + 1, y - 1);
    let dl = tile_at(x - 1, y + 1);
    let dr = tile_at(x + 1, y + 1);
    let ulx, uly, urx, ury, dlx, dly, drx, dry;

    /* Draw top left */
    if (u === tile_type) {
        if (l === tile_type) {
            if (ul === tile_type) {
                /* Open water */
                ulx = 2; uly = 4;
            } else {
                /* Upper left corner */
                ulx = 2; uly = 0;
            }
        } else {
            /* Left border */
            ulx = 0; uly = 4;
        }
    } else {
        if (l === tile_type) {
            /* Top border */
            ulx = 2; uly = 2;
        } else {
            /* Very corner */
            ulx = 0; uly = 2;
        }
    }

    /* Draw top right */
    if (u === tile_type) {
        if (r === tile_type) {
            if (ur === tile_type) {
                /* Open water */
                urx = 1; ury = 4;
            } else {
                /* Upper right corner */
                urx = 3; ury = 0;
            }
        } else {
            /* Right border */
            urx = 3; ury = 4;
        }
    } else {
        if (r === tile_type) {
            /* Top border */
            urx = 1; ury = 2;
        } else {
            /* Very corner */
            urx = 3; ury = 2;
        }
    }

    /* Draw bottom left */
    if (d === tile_type) {
        if (l === tile_type) {
            if (dl === tile_type) {
                /* Open water */
                dlx = 2; dly = 3;
            } else {
                /* Bottom left corner */
                dlx = 2; dly = 1;
            }
        } else {
            /* Left border */
            dlx = 0; dly = 3;
        }
    } else {
        if (l === tile_type) {
            /* Bottom border */
            dlx = 2; dly = 5;
        } else {
            /* Very corner */
            dlx = 0; dly = 5;
        }
    }

    /* Draw bottom right */
    if (d === tile_type) {
        if (r === tile_type) {
            if (dr === tile_type) {
                /* Open water */
                drx = 1; dry = 3;
            } else {
                /* Bottom right corner */
                drx = 3; dry = 1;
            }
        } else {
            /* Right border */
            drx = 3; dry = 3;
        }
    } else {
        if (r === tile_type) {
            /* Bottom border */
            drx = 1; dry = 5;
        } else {
            /* Very corner */
            drx = 3; dry = 5;
        }
    }

    return { ulx: ulx, uly: uly, urx: urx, ury: ury, dlx: dlx, dly: dly, drx: drx, dry: dry };
}

function draw_map(ctx) {
    for (let y = 0; y < game.level_h; y++) {
        for (let x = 0; x < game.level_w; x++) {
            if ((x + y) % 2 == 1) {
                ctx.fillStyle = 'cornflowerblue';
                ctx.fillRect(x * game.tile_size, y * game.tile_size, game.tile_size, game.tile_size);
            }
        }
    }

    let ts = game.tile_size;
    for (let y = 0; y < game.level_h; y++) {
        for (let x = 0; x < game.level_w; x++) {
            if (tile_at(x, y) === Tile.GROUND) {
                zb.sprite_draw(ctx, game.img.ground_tile, ts, ts, 0, (x + y) % 2, x * ts, y * ts);
            } else if (tile_at(x, y) === Tile.WATER) {
                let { ulx, uly, urx, ury, dlx, dly, drx, dry } = rpgmaker_tile_format_thing(x, y, Tile.WATER);
                /* Correct for frames with water animation. I really need to put tile/sprite animations
                 * into the actual engine, this stuff always turns into spaghetti code */
                uly += 6 * water.frame;
                ury += 6 * water.frame;
                dly += 6 * water.frame;
                dry += 6 * water.frame;
                zb.sprite_draw(ctx, game.img.water_tile, ts / 2, ts / 2, ulx, uly, x * ts, y * ts);
                zb.sprite_draw(ctx, game.img.water_tile, ts / 2, ts / 2, urx, ury, x * ts + ts / 2, y * ts);
                zb.sprite_draw(ctx, game.img.water_tile, ts / 2, ts / 2, dlx, dly, x * ts, y * ts + ts / 2);
                zb.sprite_draw(ctx, game.img.water_tile, ts / 2, ts / 2, drx, dry, x * ts + ts / 2, y * ts + ts / 2);
            } else if (tile_at(x, y) === Tile.SNOW) {
                let { ulx, uly, urx, ury, dlx, dly, drx, dry } = rpgmaker_tile_format_thing(x, y, Tile.SNOW);
                zb.sprite_draw(ctx, game.img.snow_tile, ts / 2, ts / 2, ulx, uly, x * ts, y * ts);
                zb.sprite_draw(ctx, game.img.snow_tile, ts / 2, ts / 2, urx, ury, x * ts + ts / 2, y * ts);
                zb.sprite_draw(ctx, game.img.snow_tile, ts / 2, ts / 2, dlx, dly, x * ts, y * ts + ts / 2);
                zb.sprite_draw(ctx, game.img.snow_tile, ts / 2, ts / 2, drx, dry, x * ts + ts / 2, y * ts + ts / 2);
            } else if (tile_at(x, y) === Tile.PATCHY) {
                let { ulx, uly, urx, ury, dlx, dly, drx, dry } = rpgmaker_tile_format_thing(x, y, Tile.PATCHY);
                zb.sprite_draw(ctx, game.img.patchy_tile, ts / 2, ts / 2, ulx, uly, x * ts, y * ts);
                zb.sprite_draw(ctx, game.img.patchy_tile, ts / 2, ts / 2, urx, ury, x * ts + ts / 2, y * ts);
                zb.sprite_draw(ctx, game.img.patchy_tile, ts / 2, ts / 2, dlx, dly, x * ts, y * ts + ts / 2);
                zb.sprite_draw(ctx, game.img.patchy_tile, ts / 2, ts / 2, drx, dry, x * ts + ts / 2, y * ts + ts / 2);
            } else if (tile_at(x, y) === Tile.SIGN) {
                let { ulx, uly, urx, ury, dlx, dly, drx, dry } = rpgmaker_tile_format_thing(x, y, Tile.SIGN);
                zb.sprite_draw(ctx, game.img.sign_tile, ts / 2, ts / 2, ulx, uly, x * ts, y * ts);
                zb.sprite_draw(ctx, game.img.sign_tile, ts / 2, ts / 2, urx, ury, x * ts + ts / 2, y * ts);
                zb.sprite_draw(ctx, game.img.sign_tile, ts / 2, ts / 2, dlx, dly, x * ts, y * ts + ts / 2);
                zb.sprite_draw(ctx, game.img.sign_tile, ts / 2, ts / 2, drx, dry, x * ts + ts / 2, y * ts + ts / 2);
            }
        }
    }

    if (game.img.level[level_number] && !intitle && !inend) {
        ctx.save();
        ctx.translate(0, -TOP_BAR_SIZE);
        zb.screen_draw(ctx, game.img.level[level_number]);
        ctx.restore();
    }
}

function draw_objects(ctx) {
    /* dumb way to do this */
    let objs = [ ...backgrass, ...hares, ...grass ];
    objs.sort((a, b) => {
        let ay = a.y;
        if (a.target_y && a.target_y > a.y) {
            ay = a.target_y;
        }
        let by = b.y;
        if (b.target_y && b.target_y > b.y) {
            by = b.target_y;
        }
        return ay - by;
    });

    for (let o of objs) {
        if (o.is_hare) {
            draw_hare(ctx, o);
        } else if (o.is_backgrass) {
            draw_backgrass(ctx, o);
        } else if (o.is_grass) {
            draw_grass(ctx, o);
        }
    }
}

function draw_hare(ctx, h) {
    let img;
    if (h.type === HareType.WHITE) {
        img = game.img.hare_white;
    } else if (h.type === HareType.BROWN) {
        img = game.img.hare_brown;
    }

    let ts = game.tile_size;
    let draw_x = h.x * ts - ts;
    let draw_y = h.y * ts - ts - HARE_OFFSET;
    if (h.being_pushed) {
        let pf = push_fraction;
        /* Slide them along in accordance with push_fraction if they're being pushed */
        draw_x = (h.x * (1 - pf) + h.target_x * pf) * ts - ts;
        draw_y = (h.y * (1 - pf) + h.target_y * pf) * ts - ts - HARE_OFFSET;
    }

    zb.sprite_draw(ctx, img, 72, 72, h.dir, h.frame, draw_x, draw_y);
}

function draw_backgrass(ctx, g) {
    let ts = game.tile_size;
    zb.sprite_draw(ctx, game.img.backgrass, 72, 72, 0, g.eaten ? 1 : 0, g.x * ts - ts, g.y * ts - ts - GRASS_OFFSET);
}

function draw_grass(ctx, g) {
    let ts = game.tile_size;
    zb.sprite_draw(ctx, game.img.frontgrass, 72, 72, 0, g.eaten ? 1 : 0, g.x * ts - ts, g.y * ts - ts - GRASS_OFFSET);
}

function draw_selector(ctx) {
    let ts = game.tile_size;

    if (game.state === State.STAND || game.state === State.DRAG) {
        if (selector.x !== null && selector.y !== null) {
            zb.sprite_draw(ctx, game.img.selector, 72, 72, 0, selector.frame, selector.x * ts - ts, selector.y * ts - ts);
        }
    }

    if (game.state === State.DRAG) {
        for (let component of path) {
            zb.sprite_draw(ctx, game.img.selector, 72, 72, 0, 2, component.x * ts - ts, component.y * ts - ts);
        }

        for (let component of path_extra) {
            zb.sprite_draw(ctx, game.img.selector, 72, 72, 0, 3 + component.dir, component.x * ts - ts, component.y * ts - ts);
        }
    }
}

function draw_ui(ctx) {
    if (game.state === State.WIN) {
        ctx.save();
        ctx.translate(0, Math.round(-win_title_offset));
        zb.screen_draw(ctx, game.img.welldone);
        if (win_title_offset === 0) {
            ctx.save();
            ctx.globalAlpha = ctc_alpha;
            zb.screen_draw(ctx, game.img.clicktocontinue);
            ctx.restore();
        }
        ctx.restore();
    }

    if (intitle) {
        ctx.save();
        ctx.translate(0, -TOP_BAR_SIZE);
        zb.screen_draw(ctx, game.img.title);
        ctx.restore();
    } else if (inend) {
        ctx.save();
        ctx.translate(0, -TOP_BAR_SIZE);
        zb.screen_draw(ctx, game.img.end);
        ctx.restore();
    } else {
        /* Reset button */
        zb.sprite_draw(ctx, game.img.buttons, 16, 16, 1, game.buttons.reset.state, game.screen_w - 20, -20);
        /* Undo button */
        zb.sprite_draw(ctx, game.img.buttons, 16, 16, 0, game.buttons.undo.state, game.screen_w - 40, -20);
    }
}


/* ---- event handlers ---- */

function handle_keydown(game, e) {
    // key down
}

let x_pressed = false;
function handle_keyup(game, e) {
    // key up
    switch (e.key) {
        case 'm':
            game.toggle_mute();
            e.preventDefault();
            break;
        case 'r':
            reset();
            e.preventDefault();
            break;
        case 'z':
            undo();
            e.preventDefault();
            break;
        case 'x':
            x_pressed = true;
            break;
        case 'w':
            if (x_pressed) {
                delete_save();
                e.preventDefault();
            }
            break;
    }

    if (e.keyCode !== 88) {
        /* non-X key */
        x_pressed = false;
    }
}

function handle_mousedown(game) {
    if (intitle) {
        game.long_transition(zb.transition.FADE, 1000, function() {
            intitle = false;
            load_level();
        });
    }

    if (inend) {
        game.long_transition(zb.transition.FADE, 1000, function() {
            inend = false;
            intitle = true;
            level_number = 1;
            load_level_data(levels.title);
        });
    }

    for (let b of Object.values(game.buttons)) {
        if (b.state === 1) {
            b.state = 2;
            return;
        }
    }

    if (game.state === State.STAND) {
        if (selector.x !== null && selector.y !== null) {
            let hare = hare_at(selector.x, selector.y);
            if (hare && hare_matches_tile(hare, tile_at(hare.x, hare.y))) {
                game.state = State.DRAG;
                hop_target = hare;
            }
        }
    }

    if (game.state === State.WIN && win_title_offset === 0) {
        advance_level();
    }
}

function handle_mouseup(game) {
    for (let b of Object.values(game.buttons)) {
        if (b.state === 2) {
            b.callback();
            b.state = 1;
            return;
        }
    }

    if (game.state === State.DRAG) {
        if (path.length > 0) {
            create_undo_point();
            game.state = State.HOPDIR;
            hop_frame_length = Math.max(5, 100 - Math.log(path.length) / Math.log(1.3) * 7);
        } else {
            game.state = State.STAND;
        }
    }
}

function update_selector(x, y) {
    let tile_x = Math.floor(x / game.tile_size);
    let tile_y = Math.floor(y / game.tile_size);

    selector.x = null;
    selector.y = null;

    if (intitle || inend) return;

    if (0 <= tile_x && tile_x < game.level_w && 0 <= tile_y && tile_y < game.level_h) {
        selector.x = tile_x;
        selector.y = tile_y;
    }
}

function handle_mousemove(game, e, x, canvy) {
    let y = canvy - TOP_BAR_SIZE;

    mouse_x = x;
    mouse_y = y;

    for (let b of Object.values(game.buttons)) {
        if (mouse_x >= b.x && mouse_x < b.x + b.w && mouse_y >= b.y && mouse_y < b.y + b.h) {
            b.state = 1;
        } else {
            b.state = 0;
        }
    }

    if (game.state === State.STAND) {
        update_selector(x, y);
    } else if (game.state === State.DRAG) {
        let tile_x = Math.floor(x / game.tile_size);
        let tile_y = Math.floor(y / game.tile_size);

        let tile_list = [ selector, ...path ];
        let last = tile_list[tile_list.length - 1];

        let revert = { x: null, y: null };
        if (tile_list.length > 1) {
            revert = tile_list[tile_list.length - 2];
        }

        if (tile_x === revert.x && tile_y === revert.y) {
            path.pop();
            path_extra.pop();
        } else if (tile_x !== last.x || tile_y !== last.y) {
            if (tile_x === last.x - 1 && tile_y === last.y
                    || tile_x === last.x + 1 && tile_y === last.y
                    || tile_x === last.x && tile_y === last.y + 1
                    || tile_x === last.x && tile_y === last.y - 1) {
                if (0 <= tile_x && tile_x < game.level_w && 0 <= tile_y && tile_y < game.level_h) {
                    if (tile_at(tile_x, tile_y) !== Tile.WATER) {
                        if (hare_matches_tile(hop_target, tile_at(last.x, last.y))) {
                            path.push({ x: tile_x, y: tile_y });
                            if (last.x - 1 === tile_x) {
                                path_extra.push({ x: last.x, y: last.y, dir: Dir.LEFT });
                            } else if (last.x + 1 === tile_x) {
                                path_extra.push({ x: last.x, y: last.y, dir: Dir.RIGHT });
                            } else if (last.y - 1 === tile_y) {
                                path_extra.push({ x: last.x, y: last.y, dir: Dir.UP });
                            } else if (last.y + 1 === tile_y) {
                                path_extra.push({ x: last.x, y: last.y, dir: Dir.DOWN });
                            }
                        }
                    }
                }
            }
        }
    }
}

function handle_mouseleave(game, e) {
    if (game.state === State.STAND) {
        selector.x = null;
        selector.y = null;
    }

    for (let b of Object.values(game.buttons)) {
        b.state = 0;
    }
}

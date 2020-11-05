(function () {
    "use strict";

    // The size in pixels of the game area.
    const WIDTH = 800;
    const HEIGHT = 600;

    // The horizon height, in pixels from the top of the viewport.
    const HORIZON = 350;

    // The player's field of view, in degrees.
    const FOV = 90;

    // The size, in pixels, of the moon.
    const MOON_RADIUS = 40;

    // The fraction at which the moon is considered to have set. This is also
    // the fraction that is initially below the horizon.
    const MOON_SET = 0.8;
    const MOON_END = MOON_SET * MOON_RADIUS + HORIZON;

    // How high the moon would appear if visible at its peak height. High
    // enough to be well off the screen!
    const MOON_PEAK = HEIGHT + 2 * MOON_RADIUS;

    // The near and far limits on scenery.
    const MIN_DIST = 1;
    const MAX_DIST = 20;

    // The size, in pixels, of trees.
    const TREE_WIDTH = 150;
    const TREE_HEIGHT = 200;
    const TREE_MAX_SCALE = 1;

    // The game duration, in minutes.
    const GAME_DUR = 1;

    // Utility functions.
    function randInt(max, min) {
        if (typeof min === "undefined") {
            min = 1;
        }
        return Math.floor((max - min + 1) * Math.random()) + min;
    }

    // Player data.
    var Player = new Phaser.Class({
        initialize: function Player() {
            this.rot = 0.0;
            this.rot_speed = Phaser.Math.GetSpeed(180, 3);
        }
    })

    var player = new Player();

    // Game objects.

    // The moon.
    var Moon = new Phaser.Class({
        Extends: Phaser.GameObjects.Image,

        initialize: function Moon(scene, image, speed) {
            Phaser.GameObjects.Image.call(this, scene, WIDTH / 2.0,
                                          MOON_END, image);
            this.setDisplaySize(MOON_RADIUS * 2, MOON_RADIUS * 2);
            this.setVisible(true);
            this.angle = 0.0;
            this.speed = speed;
            this.last_mark = 0.0; //DEBUG
        },

        update: function (delta) {
            this.angle += this.speed * delta;

            let direction = 0;
            let height = this.angle / 90 * MOON_PEAK;

            if (height > MOON_PEAK) {
                // Come down the other side of the sky.
                height = 2 * MOON_PEAK - height
                direction = 180;
                this.setFlip(true, true);
            }
            let x = WIDTH / FOV * (direction - player.rot) + WIDTH / 2.0;
            let y = MOON_END - height;
            this.setPosition(x, y);
        }
    });

    // An immobile item of scenery.
    var Scenery = new Phaser.Class({
        Extends: Phaser.GameObjects.Image,

        initialize: function Scenery(scene, sheet, frame, r, theta) {
            Phaser.GameObjects.Image.call(this, scene, 0, 0, sheet,
                                          frame);
            this.r = r;
            this.theta = theta;
            this.updatePosition();
            this.setScale(TREE_MAX_SCALE / r);
        },

        updatePosition: function () {
            let x = WIDTH / FOV * (this.theta - player.rot) + WIDTH / 2.0;
            let y = HORIZON;
            this.setPosition(x, y);
        },

        update: function() {
            this.updatePosition();
        }
    });

    // A collection of Scenery instances.
    var scenery;

    // The game controls.
    var controls;

    // Phaser Scene functions.

    /**
     * Preload the game assets.
     */
    function preload() {
        this.load.image("background", "./assets/night-sky.png");
        this.load.image("ground", "./assets/ground.png");
        this.load.image("moon", "./assets/moon.png");
        this.load.spritesheet("trees", "./assets/trees.png",
                              {frameWidth: TREE_WIDTH,
                               frameHeight: TREE_HEIGHT});
    }

    /**
     * Create the game state after loading is complete.
     */
    function create() {
        let bg = this.add.image(0, 0, "background");
        bg.setOrigin(0, 0);
        bg.setDisplaySize(WIDTH, HEIGHT);

        this.moon = new Moon(this, "moon",
                             Phaser.Math.GetSpeed(180, 60 * GAME_DUR));
        this.add.existing(this.moon);

        let ground = this.add.image(0, HORIZON, "ground");
        ground.setOrigin(0, 0);
        ground.setDisplaySize(WIDTH, HEIGHT - HORIZON);

        scenery = this.add.group({
            classType: Scenery,
            runChildUpdate: true
        });
        // Create some random trees.
        const availableDesigns = this.textures.get("trees").frameTotal - 1;
        let trees = [];
        for (let i = 0; i < 30; i++) {
            let randomDesign = Math.floor(availableDesigns * Math.random());
            let tree = new Scenery(this, "trees", randomDesign,
                                   randInt(MAX_DIST, MIN_DIST),
                                   randInt(360, 0));
            trees.push(tree);
        }
        scenery.addMultiple(trees, true);

        controls = this.input.keyboard.createCursorKeys();
    };

    /**
     * Update the game state.
     *
     * Parameters:
     *   time - The current time, in milliseconds
     *   delta - The time in milliseconds since the last frame
     */
    function update(time, delta) {
        this.moon.update(delta);

        if (controls.left.isDown) {
            player.rot -= player.rot_speed * delta;
            while (player.rot < 0) {
                player.rot += 360;
            }
        } else if (controls.right.isDown) {
            player.rot += player.rot_speed * delta
            while (player.rot > 360) {
                player.rot -= 360;
            };
        }
    }

    // Finally, create the game itself.

    let config = {
        type: Phaser.AUTO,
        width: WIDTH,
        height: HEIGHT,
        scene: {
            preload: preload,
            create: create,
            update: update
        }
    };

    var game = new Phaser.Game(config);
})();

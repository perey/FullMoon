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

    // The possible game states.
    const GAME_STATE = {
        NOT_STARTED: 1,
        RUNNING: 2,
        PAUSED: 3,
        ENDED: 4
    };

    var gameState;

    // Utility functions.
    function randInt(max, min) {
        if (typeof min === "undefined") {
            min = 1;
        }
        return Math.floor((max - min + 1) * Math.random()) + min;
    }

    function angleToXPosition(angle) {
        // Find the visual angle by rotating the position angle.
        let screenAngle = angle - player.rot;

        // Correct for the cases that give us an angle 360° more or less than
        // our intended interval.
        if (angle >= 360 - FOV / 2 && player.rot <= FOV / 2) {
            screenAngle -= 360;
        } else if (angle <= FOV / 2 && player.rot >= 360 - FOV / 2) {
            screenAngle += 360;
        }
        // Convert the visual angle to a horizontal position.
        return WIDTH / FOV * screenAngle + WIDTH / 2.0;
    }

    // Player data.
    var Player = new Phaser.Class({
        initialize: function Player() {
            this.rot = 0.0;
            this.rotSpeed = Phaser.Math.GetSpeed(180, 3);
        },

        turnLeft: function (delta) {
            this.rot -= this.rotSpeed * delta;
            while (this.rot < 0) {
                this.rot += 360;
            }
        },

        turnRight: function (delta) {
            this.rot = (this.rot + this.rotSpeed * delta) % 360;
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
            this.elevationAngle = 0.0;
            this.angularSpeed = speed;
        },

        update: function (time, delta) {
            this.elevationAngle += this.angularSpeed * delta;

            let direction = 0;
            let height = this.elevationAngle / 90 * MOON_PEAK;

            if (height > MOON_PEAK) {
                // Come down the other side of the sky.
                height = 2 * MOON_PEAK - height
                direction = 180;
                this.setFlip(true, true);
            }
            let x = angleToXPosition(direction);
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
            // Set the initial position and the (unchanging) size.
            this.update();
            this.setScale(TREE_MAX_SCALE / r);
        },

        update: function () {
            // Convert the visual angle to a horizontal position.
            let x = angleToXPosition(this.theta);
            // Centre all scenery on the horizon.
            let y = HORIZON;
            this.setPosition(x, y);
        }
    });

    // The game controls.
    var controls;

    // Create a Phaser Scene.
    var FullMoonScene = new Phaser.Class({
        Extends: Phaser.Scene,

        preload: function () {
            this.load.image("background", "./assets/night-sky.png");
            this.load.image("ground", "./assets/ground.png");
            this.load.image("moon", "./assets/moon.png");
            this.load.spritesheet("trees", "./assets/trees.png",
                                  {frameWidth: TREE_WIDTH,
                                   frameHeight: TREE_HEIGHT});
        },

        create: function () {
                let titleObjects = this.add.group({active: false, runChildUpdate: true});
                let gameObjects = this.add.group({active: true, runChildUpdate: true});
                let menuObjects = this.add.group({active: false, runChildUpdate: true});

                let bg = new Phaser.GameObjects.Image(this, 0, 0, "background");
                bg.setOrigin(0, 0);
                bg.setDisplaySize(WIDTH, HEIGHT);
                gameObjects.add(bg, true);

                let moon = new Moon(this, "moon",
                                    Phaser.Math.GetSpeed(180, 60 * GAME_DUR));
                gameObjects.add(moon, true);

                let ground = this.add.image(0, HORIZON, "ground");
                ground.setOrigin(0, 0);
                ground.setDisplaySize(WIDTH, HEIGHT - HORIZON);

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
                gameObjects.addMultiple(trees, true);

                controls = this.input.keyboard.createCursorKeys();

                gameState = GAME_STATE.RUNNING;
                this.gameClock = 0.0;
        },

        update: function (time, delta) {
                if (this.gameClock >= GAME_DUR * 60 * 1000) {
                    // Game over!
                    gameState = GAME_STATE.ENDED;
                }

                if (gameState === GAME_STATE.RUNNING) {
                    this.gameClock += delta;

                    if (controls.left.isDown) {
                        player.turnLeft(delta);
                    } else if (controls.right.isDown) {
                        player.turnRight(delta);
                    }
                }
        }
    });

    // Finally, create the game itself.

    let config = {
        type: Phaser.AUTO,
        width: WIDTH,
        height: HEIGHT,
        scene: new FullMoonScene()
    };

    var game = new Phaser.Game(config);
})();

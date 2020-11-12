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

    // The near and far limits on trees.
    const MIN_DIST = 1;
    const MAX_DIST = 15;

    // The size, in pixels, of trees.
    const TREE_WIDTH = 150;
    const TREE_HEIGHT = 200;
    const TREE_MAX_SCALE = 1.25;

    // The size, in pixels, of people.
    const HUMAN_WIDTH = 75;
    const HUMAN_HEIGHT = 85;
    const HUMAN_HEIGHT_OFFSET = 0.1;

    // How fast people run.
    // FIXME: Why is this not the calculated 208 units per second?
    const HUMAN_SPEED = Phaser.Math.GetSpeed(0.6, 1);

    // The game duration, in minutes.
    const GAME_DUR = 1;

    // The possible game states.
    const GAME_STATE = {
        RUNNING: 1,
        PAUSED: 2,
        ENDED: 3
    };

    var gameState;

    // Utility functions.
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

    // An immobile bit of scenery that blocks shots.
    var Tree = new Phaser.Class({
        Extends: Phaser.GameObjects.Image,

        initialize: function Tree(scene, sheet, frame, worldPos) {
            Phaser.GameObjects.Image.call(this, scene, 0, 0, sheet,
                                          frame);
            this.worldPos = worldPos;
            // Set the initial position and the (unchanging) size.
            this.update();
            this.setScale(TREE_MAX_SCALE / this.worldPos.length());
        },

        update: function () {
            // Convert the visual angle to a horizontal position.
            let x = angleToXPosition(this.worldPos.angle() *
                                     Phaser.Math.RAD_TO_DEG);
            // Centre all trees on the horizon.
            let y = HORIZON;
            this.setPosition(x, y);
        }
    });

    // A friendly. Don't shoot!
    var Friendly = new Phaser.Class({
        Extends: Phaser.GameObjects.Sprite,

        initialize: function Friendly(scene, sheet, animLeft, animRight,
                                      animAt, worldPos) {
            Phaser.GameObjects.Sprite.call(this, scene, 0, 0, sheet);
            this.setOrigin(0.5, HUMAN_HEIGHT_OFFSET);
            this.animLeft = animLeft;
            this.animRight = animRight;
            this.animAt = animAt;
            this.currentAnim = null;
            this.worldPos = worldPos;

            // Set the original position and size.
            this.updatePosition();
        },

        update: function (time, delta) {
            // Consider which direction to move in.
            let dir = this.worldPos.angle() + Math.PI / 2; // FIXME

            // Select the right sprite for the given direction.
            let chosenAnim = this.animRight; // FIXME
            if (this.currentAnim !== chosenAnim) {
                this.currentAnim = chosenAnim;
                this.play(chosenAnim);
            }

            // Move in the current direction.
            let step = new Phaser.Math.Vector2(0, 0);
            step.setToPolar(dir, HUMAN_SPEED * delta);
            this.worldPos.add(step);

            // Set the new on-screen position and size.
            this.updatePosition();
        },

        updatePosition: function () {
            // Convert the visual angle to a horizontal position.
            let x = angleToXPosition(this.worldPos.angle() *
                                     Phaser.Math.RAD_TO_DEG);
            // Put head height at the horizon.
            let y = HORIZON;
            this.setPosition(x, y);
            this.setScale(1 / this.worldPos.length());
        }
    })

    // A progress bar for the loading screen.
    var ProgressBar = new Phaser.Class({
        Extends: Phaser.GameObjects.Group,

        initialize: function ProgressBar(scene, x, y, width, height) {
            Phaser.GameObjects.Group.call(this, scene);

            this.outline = new Phaser.GameObjects.Rectangle(scene, x, y,
                                                            width, height,
                                                            0x000000);
            this.outline.setOrigin(0.5);
            this.outline.setStrokeStyle(2, 0xFFFFFF);
            this.add(this.outline, true);

            let bounds = this.outline.getBounds();
            this.fillRect = new Phaser.GameObjects.Rectangle(scene,
                                                             bounds.left + 3,
                                                             bounds.top + 3, 0,
                                                             bounds.height - 6,
                                                             0xFFFFFF);
            this.fillRect.setOrigin(0, 0);
            this.add(this.fillRect, true);
        },

        setProgress: function (progress) {
            let bounds = this.outline.getBounds();
            this.fillRect.width = progress * (bounds.width - 6);
        }
    })

    // The game controls.
    var controls;

    // Phaser scenes for each part of the game.
    var PreloaderScene = new Phaser.Class({
        Extends: Phaser.Scene,

        initialize: function PreloaderScene() {
            Phaser.Scene.call(this, {
                key: "PreloaderScene"
            });
        },

        preload: function() {
            let loadingText = this.add.text(WIDTH / 2, HEIGHT / 2 - 30,
                                            "Loading",
                                            {font: "30px sans-serif",
                                             fill: "#FFFFFF"});
            loadingText.setOrigin(0.5, 0);

            let progressBar = new ProgressBar(this, WIDTH / 2, HEIGHT / 2 + 30,
                                              200, 30);
            this.load.on("progress", function (progress) {
                progressBar.setProgress(progress);
            });

            this.load.image("title", "./assets/title.png");
            this.load.image("sky", "./assets/night-sky.png");
            this.load.image("ground", "./assets/ground.png");
            this.load.image("moon", "./assets/moon.png");
            this.load.image("gun", "./assets/gun.png");
            this.load.spritesheet("trees", "./assets/trees.png",
                                  {frameWidth: TREE_WIDTH,
                                   frameHeight: TREE_HEIGHT});
            this.load.spritesheet("runner", "./assets/runner.png",
                                  {frameWidth: HUMAN_WIDTH,
                                  frameHeight: HUMAN_HEIGHT});
            this.load.audio("titleMusic", ["./assets/title.ogg",
                                           "./assets/title.mp3",
                                           "./assets/title.m4a"]);
            this.load.audio("gameMusic", ["./assets/game.ogg",
                                          "./assets/game.mp3",
                                          "./assets/game.m4a"]);
        },

        create: function() {
            this.anims.create({
                key: "runRight",
                frameRate: 16,
                frames: this.anims.generateFrameNumbers("runner", {start: 0,
                                                                   end: 5}),
                repeat: -1
            });

            this.anims.create({
                key: "runLeft",
                frameRate: 16,
                frames: this.anims.generateFrameNumbers("runner", {start: 6,
                                                                   end: 11}),
                repeat: -1
            });

            this.anims.create({
                key: "runAt",
                frameRate: 16,
                frames: this.anims.generateFrameNumbers("runner", {start: 12,
                                                                   end: 23}),
                repeat: -1
            });

            this.scene.start("TitleScene");
        }
    });

    var TitleScene = new Phaser.Class({
        Extends: Phaser.Scene,

        initialize: function PreloaderScene() {
            Phaser.Scene.call(this, {
                key: "TitleScene"
            });
        },

        create: function() {
            let bg = this.add.image(0, 0, "title");
            bg.setOrigin(0, 0);
            bg.setDisplaySize(WIDTH, HEIGHT);

            this.music = this.sound.add("titleMusic", {loop: true});
            this.music.play();

            this.input.keyboard.on("keydown-SPACE", this.next);
        },

        next: function () {
            this.scene.music.stop();
            this.scene.scene.start("GameplayScene");
        }
    });

    var GameplayScene = new Phaser.Class({
        Extends: Phaser.Scene,

        initialize: function PreloaderScene() {
            Phaser.Scene.call(this, {
                key: "GameplayScene"
            });
        },

        create: function () {
            this.createGameObjects();

            this.music = this.sound.add("gameMusic", {loop: true});
            this.music.play();

            controls = this.input.keyboard.createCursorKeys();

            gameState = GAME_STATE.RUNNING;
            this.gameClock = 0.0;
        },

        update: function (time, delta) {
            if (this.gameClock >= GAME_DUR * 60 * 1000) {
                // Game over!
                gameState = GAME_STATE.ENDED;
                this.music.stop();
            }

            if (gameState === GAME_STATE.RUNNING) {
                this.gameClock += delta;

                if (controls.left.isDown) {
                    player.turnLeft(delta);
                } else if (controls.right.isDown) {
                    player.turnRight(delta);
                }
            }
        },

        createGameObjects: function () {
            let gameObjects = this.add.group({active: true, runChildUpdate: true});

            let sky = new Phaser.GameObjects.Image(this, 0, 0, "sky");
            sky.setOrigin(0, 0);
            sky.setDisplaySize(WIDTH, HEIGHT);
            gameObjects.add(sky, true);

            let moon = new Moon(this, "moon",
                                Phaser.Math.GetSpeed(180, 60 * GAME_DUR));
            gameObjects.add(moon, true);

            let ground = new Phaser.GameObjects.Image(this, 0, HORIZON,
                                                      "ground");
            ground.setOrigin(0, 0);
            ground.setDisplaySize(WIDTH, HEIGHT - HORIZON);
            gameObjects.add(ground, true);

            // Create some random trees.
            const availableDesigns = this.textures.get("trees").frameTotal - 1;
            let trees = [];
            for (let theta = 0; theta < 360; theta += 2) {
                let randomShift = Math.random() - 0.5;
                let randomDesign = Math.floor(availableDesigns * Math.random());
                let randomDist = (Math.random() * (MAX_DIST - MIN_DIST) +
                                  MIN_DIST);
                let pos = new Phaser.Math.Vector2(0, 0);
                pos.setToPolar((theta + randomShift) * Phaser.Math.DEG_TO_RAD,
                               randomDist);
                let tree = new Tree(this, "trees", randomDesign, pos);
                trees.push(tree);
            }
            gameObjects.addMultiple(trees, true);

            let testPos = new Phaser.Math.Vector2(0, 0);
            testPos.setToPolar(0, 2);
            let testFriendly = new Friendly(this, "runner", "runLeft",
                                            "runRight", "runAt", testPos);
            gameObjects.add(testFriendly, true);

            // The bunker's edges.
            let lowerEdge = new Phaser.GameObjects.Rectangle(this, 0, 
                                                             HEIGHT - 80,
                                                             WIDTH, 80,
                                                             0x888888);
            lowerEdge.setOrigin(0, 0);
            gameObjects.add(lowerEdge, true);

            let gun = new Phaser.GameObjects.Image(this, WIDTH / 2, HEIGHT,
                                                   "gun");
            gun.setOrigin(0.5, 1);
            gameObjects.add(gun, true);
        }
    });

    // Finally, create the game itself.

    let config = {
        type: Phaser.AUTO,
        width: WIDTH,
        height: HEIGHT,
        scene: [PreloaderScene, TitleScene, GameplayScene]
    };

    var game = new Phaser.Game(config);
})();

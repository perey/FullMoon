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
    const MIN_TREE_DIST = 1;
    const MAX_TREE_DIST = 15;

    // The size, in pixels, of title screen buttons.
    const BUTTON_WIDTH = 250;
    const BUTTON_HEIGHT = 110;
    const BUTTON_SHIFT = 10;

    // The size, in pixels, of trees.
    const TREE_WIDTH = 150;
    const TREE_HEIGHT = 200;
    const TREE_SCALE = 1.25;

    // The size, in pixels, of people.
    const HUMAN_WIDTH = 75;
    const HUMAN_HEIGHT = 85;
    const HUMAN_SCALE = 1;
    const HUMAN_HEIGHT_OFFSET = 0.1;
    const HUMAN_SPAWN_DISTANCE = 16;
    const HUMAN_SAFE_DISTANCE = 0.1;

    // How fast people run.
    // FIXME: Why is this not the calculated 208 units per second?
    const HUMAN_SPEED = Phaser.Math.GetSpeed(0.6, 1);

    // How often to spawn a new human (unless there are none left, in which
    // case one is spawned at once), in seconds.
    const HUMAN_DELAY = 20;
    var humanDelay = 0;

    // The size, in pixels, of werewolves.
    const WOLF_WIDTH = 162;
    const WOLF_HEIGHT = 125;
    const WOLF_SCALE = 0.8;
    const WOLF_HEIGHT_OFFSET = 0;

    // How fast werewolves run.
    // FIXME: Scale to match human speed.
    const WOLF_SPEED = Phaser.Math.GetSpeed(1.5, 1);

    // The delay, in milliseconds, between shots.
    const SHOT_DELAY = 400; // 150 shots per minute.

    // How large, in worldspace units, is the shooting zone? (The wider, the
    // less precise aiming needs to be.)
    const KILLZONE_LENGTH = 20;
    const KILLZONE_WIDTH = 140;

    // The game duration, in minutes.
    const GAME_DUR = 5;

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

        initialize: function Tree(scene, sheet, worldPos) {
            // Choose a random frame. (Why "- 1"? I don't know! But it thinks
            // there's one more frame than there actually is.)
            let frameCount = scene.textures.get(sheet).frameTotal - 1;
            let randomFrame = Phaser.Math.Between(0, frameCount - 1);

            Phaser.GameObjects.Image.call(this, scene, 0, 0, sheet,
                                          randomFrame);
            this.worldPos = worldPos;
            // Set the initial position and the (unchanging) size.
            this.update();
            this.setScale(TREE_SCALE / this.worldPos.length());
        },

        update: function () {
            // Convert the visual angle to a horizontal position.
            let x = angleToXPosition(this.worldPos.angle() *
                                     Phaser.Math.RAD_TO_DEG);
            // Centre all trees on the horizon.
            let y = HORIZON;
            this.setPosition(x, y);
        },

        shot: function () {
            // Stupid tree.
            console.log("You hit a tree.");
        }
    });

    // MOBs.
    var friendlies;
    var enemies;

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
            this.alive = true;

            // Set the original position and size.
            this.updatePosition();
        },

        update: function (time, delta) {
            if (!this.alive) {
                return;
            }
            // Consider which direction to move in.
            let dir = this.worldPos.angle() + Math.PI; // FIXME

            // Select the right animation for the given direction.
            let chosenAnim;
            let s = Math.sin(this.worldPos.angle() - dir);
            if (s ** 2 < 0.5) {
                // Running towards (or away from) the bunker.
                chosenAnim = this.animAt;
            } else if (s > 0) {
                // Running left (anticlockwise) relative to the bunker.
                chosenAnim = this.animLeft;
            } else {
                // Running right (clockwise) relative to the bunker.
                chosenAnim = this.animRight;
            }
            if (this.currentAnim !== chosenAnim) {
                this.currentAnim = chosenAnim;
                this.play(chosenAnim);
            }

            // Move in the current direction.
            let step = new Phaser.Math.Vector2(0, 0);
            step.setToPolar(dir, HUMAN_SPEED * delta);
            this.worldPos.add(step);

            // Are they safe?
            if (this.worldPos.length() <= HUMAN_SAFE_DISTANCE) {
                this.scene.savedFriendly();
                this.destroy();
            } else {
                // Set the new on-screen position and size.
                this.updatePosition();
            }
        },

        updatePosition: function () {
            // Convert the visual angle to a horizontal position.
            let x = angleToXPosition(this.worldPos.angle() *
                                     Phaser.Math.RAD_TO_DEG);
            // Put head height at the horizon.
            let y = HORIZON;
            this.setPosition(x, y);
            this.setScale(HUMAN_SCALE / this.worldPos.length());
        },

        shot: function () {
            // Oops!
            console.log("You hit a friendly!");
            this.scene.registry.inc("score", -100);
        }
    });

    // An enemy. Shoot it!
    var Enemy = new Phaser.Class({
        Extends: Phaser.GameObjects.Sprite,

        initialize: function Enemy(scene, sheet, animLeft, animRight,
                                   animAt, worldPos) {
            Phaser.GameObjects.Sprite.call(this, scene, 0, 0, sheet);
            this.setOrigin(0.5, WOLF_HEIGHT_OFFSET);
            this.animLeft = animLeft;
            this.animRight = animRight;
            this.animAt = animAt;
            this.currentAnim = null;
            this.worldPos = worldPos;

            // Set the original position and size.
            this.updatePosition();
            this.health = 3;
        },

        pickDirection: function () {
            // Find the nearest friendly.
            let target = null;
            for (let f = 0; f < friendlies.getLength(); f++) {
                let maybeTarget = friendlies.getChildren()[f];

                // Don't target them if they're already too close to the
                // bunker.
                if (maybeTarget.worldPos.length() > MIN_TREE_DIST) {
                    if (target === null ||
                        this.worldPos.distance(maybeTarget.worldPos) <
                        this.worldPos.distance(target.worldPos)) {
                            target = maybeTarget;
                    }
                }
            }
            if (target === null) {
                // No friendlies? Just take a default direction.
                return this.worldPos.angle() + Math.PI / 2;
            }
            // Run straight towards them.
            // FIXME: Avoid running through the bunker!
            let dir = new Phaser.Math.Vector2();
            dir.copy(target.worldPos);
            dir.subtract(this.worldPos);
            return dir.angle();
        },

        update: function (time, delta) {
            // Consider which direction to move in.
            let dir = this.pickDirection();

            // Select the right animation for the given direction.
            let chosenAnim;
            let s = Math.sin(this.worldPos.angle() - dir);
            if (s ** 2 < 0.5) {
                // Running towards (or away from) the bunker.
                chosenAnim = this.animAt;
            } else if (s > 0) {
                // Running left (anticlockwise) relative to the bunker.
                chosenAnim = this.animLeft;
            } else {
                // Running right (clockwise) relative to the bunker.
                chosenAnim = this.animRight;
            }
            if (this.currentAnim !== chosenAnim) {
                this.currentAnim = chosenAnim;
                this.play(chosenAnim);
            }

            // Move in the current direction.
            let step = new Phaser.Math.Vector2(0, 0);
            step.setToPolar(dir, WOLF_SPEED * delta);
            this.worldPos.add(step);

            // Set the new on-screen position and size.
            this.updatePosition();
        },

        updatePosition: function () {
            // Convert the visual angle to a horizontal position.
            let x = angleToXPosition(this.worldPos.angle() *
                                     Phaser.Math.RAD_TO_DEG);
            // Put top of frame at the horizon.
            let y = HORIZON;
            this.setPosition(x, y);
            this.setScale(WOLF_SCALE / this.worldPos.length());
        },

        shot: function () {
            // Yay!
            console.log("You hit an enemy!");
            this.scene.registry.inc("score", 10);
            this.health -= 1;

            // Is it dead?
            if (this.health <= 0) {
                this.scene.registry.inc("score", 20);
                this.scene.addEnemy();
                this.destroy();
            }
        }
    });

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
    });

    var Button = new Phaser.Class({
        Extends: Phaser.GameObjects.Group,

        initialize: function Button(scene, text, x, y, sheet, fn) {
            Phaser.GameObjects.Group.call(this, scene);

            this.y = y;

            this.buttonImage = new Phaser.GameObjects.Sprite(scene, x, y,
                                                             sheet, 0);
            this.add(this.buttonImage, true);

            this.buttonText = new Phaser.GameObjects.Text(
                scene, x, y, text,
                {font: (0.6 * BUTTON_HEIGHT) + "px sans-serif",
                 fill: "#FFFFFF"});
            this.buttonText.setOrigin(0.5, 0.6);
            this.add(this.buttonText, true);

            this.activate = fn;
        },

        deselect: function () {
            this.buttonImage.setFrame(0);
            this.buttonText.setY(this.y);
        },

        select: function () {
            this.buttonImage.setFrame(1);
            this.buttonText.setY(this.y + BUTTON_SHIFT);
        },

        toggleSelect: function () {
            let newState = +!(this.buttonImage.frame);
            this.buttonImage.setFrame(newState);
            this.buttonText.setY(this.y + newState * BUTTON_SHIFT)
        }
    });

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
            this.load.image("logo", "./assets/gameoff-white.png");
            this.load.image("sky", "./assets/night-sky.png");
            this.load.image("ground", "./assets/ground.png");
            this.load.image("moon", "./assets/moon.png");
            this.load.image("gun", "./assets/gun.png");
            this.load.spritesheet("button", "./assets/button.png",
                                  {frameWidth: BUTTON_WIDTH,
                                   frameHeight: BUTTON_HEIGHT});
            this.load.spritesheet("trees", "./assets/trees.png",
                                  {frameWidth: TREE_WIDTH,
                                   frameHeight: TREE_HEIGHT});
            this.load.spritesheet("runner", "./assets/runner.png",
                                  {frameWidth: HUMAN_WIDTH,
                                  frameHeight: HUMAN_HEIGHT});
            this.load.spritesheet("werewolf", "./assets/werewolf.png",
                                  {frameWidth: WOLF_WIDTH,
                                  frameHeight: WOLF_HEIGHT});
            this.load.spritesheet("flashFrames", "./assets/flash.png",
                                  {frameWidth: 200,
                                  frameHeight: 250});
            this.load.audio("titleMusic", ["./assets/title.ogg",
                                           "./assets/title.mp3",
                                           "./assets/title.m4a"]);
            this.load.audio("gameMusic", ["./assets/game.ogg",
                                          "./assets/game.mp3",
                                          "./assets/game.m4a"]);
            this.load.audio("gunshot", ["./assets/shot.ogg",
                                        "./assets/shot.mp3",
                                        "./assets/shot.m4a"]);
            this.load.audio("bunkerDoor", ["./assets/bunker.ogg",
                                           "./assets/bunker.mp3",
                                           "./assets/bunker.m4a"]);
            this.load.audio("howl", ["./assets/howl.ogg",
                                     "./assets/howl.mp3",
                                     "./assets/howl.m4a"]);
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

            this.anims.create({
                key: "wolfRight",
                frameRate: 16,
                frames: this.anims.generateFrameNumbers("werewolf", {start: 0,
                                                                     end: 5}),
                repeat: -1
            });

            this.anims.create({
                key: "wolfLeft",
                frameRate: 16,
                frames: this.anims.generateFrameNumbers("werewolf", {start: 6,
                                                                     end: 11}),
                repeat: -1
            });

            this.anims.create({
                key: "wolfAt",
                frameRate: 16,
                frames: this.anims.generateFrameNumbers("werewolf", {start: 12,
                                                                     end: 17}),
                repeat: -1
            });

            this.anims.create({
                key: "flash",
                frameRate: 20,
                frames: this.anims.generateFrameNumbers("flashFrames",
                                                        {start: 0, end: 3}),
                repeat: 0
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

            let logo = this.add.image(WIDTH - 10, 10, "logo");
            logo.setOrigin(1, 0);

            let playButton = new Button(this, "Play", WIDTH * 3 / 4,
                                        HEIGHT * 2 / 5, "button",
                                        this.startGame);
            this.add.existing(playButton);
            let optionsButton = new Button(this, "Options", WIDTH * 3 / 4,
                                           HEIGHT * 3 / 5, "button");
            this.add.existing(optionsButton);
            let creditsButton = new Button(this, "About", WIDTH * 3 / 4,
                                           HEIGHT * 4 / 5, "button");
            this.add.existing(creditsButton);

            this.buttons = [playButton, optionsButton, creditsButton];
            this.buttonIndex = 0
            playButton.select();

            this.music = this.sound.add("titleMusic", {loop: true});
            this.music.play();

            this.input.keyboard.on("keydown-UP", this.prevButton);
            this.input.keyboard.on("keydown-DOWN", this.nextButton);
            this.input.keyboard.on("keydown-ENTER", this.activateButton);
        },

        activateButton: function () {
            this.scene.buttons[this.scene.buttonIndex].activate();
        },

        nextButton: function() {
            this.scene.buttons[this.scene.buttonIndex].deselect();
            this.scene.buttonIndex = (this.scene.buttonIndex + 1) % this.scene.buttons.length;
            this.scene.buttons[this.scene.buttonIndex].select();
        },

        prevButton: function() {
            this.scene.buttons[this.scene.buttonIndex].deselect();
            this.scene.buttonIndex--;
            if (this.scene.buttonIndex < 0) {
                this.scene.buttonIndex += this.scene.buttons.length;
            }
            this.scene.buttons[this.scene.buttonIndex].select();
        },

        startGame: function () {
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

            this.shotCooldown = 0.0;
            this.shotSound = this.sound.add("gunshot");
            this.input.keyboard.on("keydown-SPACE", this.shoot);

            this.bunkerSound = this.sound.add("bunkerDoor");
            this.werewolfHowl = this.sound.add("howl");

            this.registry.set("score", 0);
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
                if (this.shotCooldown > 0) {
                    this.shotCooldown -= delta;
                }
                humanDelay -= delta;
                if (humanDelay <= 0) {
                    this.addFriendly();
                }
            }
        },

        createGameObjects: function () {
            let background = this.add.group({active: true,
                                             runChildUpdate: true});

            let sky = new Phaser.GameObjects.Image(this, 0, 0, "sky");
            sky.setOrigin(0, 0);
            sky.setDisplaySize(WIDTH, HEIGHT);
            background.add(sky, true);

            let moon = new Moon(this, "moon",
                                Phaser.Math.GetSpeed(180, 60 * GAME_DUR));
            background.add(moon, true);

            let ground = new Phaser.GameObjects.Image(this, 0, HORIZON,
                                                      "ground");
            ground.setOrigin(0, 0);
            ground.setDisplaySize(WIDTH, HEIGHT - HORIZON);
            background.add(ground, true);

            // Create some random trees.
            background.addMultiple(this.placeTrees(), true);

            background.setDepth(-50);

            friendlies = this.add.group({active: true,
                                         runChildUpdate: true});
            this.addFriendly();

            enemies = this.add.group({active: true,
                                      runChildUpdate: true});
            this.addEnemy();

            // The bunker's edges.
            let foreground = this.add.group({active: true,
                                             runChildUpdate: true});
            let lowerEdge = new Phaser.GameObjects.Rectangle(this, 0,
                                                             HEIGHT - 80,
                                                             WIDTH, 80,
                                                             0x888888);
            lowerEdge.setOrigin(0, 0);
            foreground.add(lowerEdge, true);
            let upperEdge = new Phaser.GameObjects.Rectangle(this, 0, 0,
                                                             WIDTH, 80,
                                                             0x555555);
            upperEdge.setOrigin(0, 0);
            foreground.add(upperEdge, true);

            this.muzzleFlash = new Phaser.GameObjects.Sprite(this, WIDTH / 2,
                                                             HEIGHT,
                                                             "flashFrames", 3);
            this.muzzleFlash.setOrigin(0.5, 1);
            foreground.add(this.muzzleFlash, true);
            let gun = new Phaser.GameObjects.Image(this, WIDTH / 2, HEIGHT,
                                                   "gun");
            gun.setOrigin(0.5, 1);
            foreground.add(gun, true);

            this.scoreText = new Phaser.GameObjects.Text(
                this, 10, 40, "0", {font: "30px sans-serif",
                                    fill: "#FFFFFF"});
            this.scoreText.update = function () {
                this.text = this.scene.registry.get("score");
            };
            this.scoreText.setOrigin(0, 0.5);
            foreground.add(this.scoreText, true);

            foreground.setDepth(50);
        },

        placeTrees: function () {
            // Randomly distribute trees, using Bridson's algorithm to avoid
            // making clusters that are too close together. These are the
            // parameters for the algorithm in two dimensions.
            const R = 1.3; // The density parameter. Experimentally tested to
                           // give about 300 trees.
            const MAX_TRIES = 30;

            // And these are useful constants for later calculations.
            const CELL_SIZE = R / Math.sqrt(2);
            const WORLD_CELLS = Math.ceil(2 * MAX_TREE_DIST / CELL_SIZE);
            const MAX_CELL_STEP = Math.ceil(2 * R / CELL_SIZE);

            // This function converts a world coordinate (x or y) in the range
            // [-MAX_TREE_DIST, MAX_TREE_DIST] to cell coordinates in the range
            // [0, WORLD_CELLS].
            let worldToGrid = function (w) {
                return Math.floor((w + MAX_TREE_DIST) / CELL_SIZE);
            }

            let trees = [];

            // Set up a 2D array to represent a grid of cells, such that only
            // one tree may be in each cell without violating the density
            // constraint. This means each cell has a size of R/sqrt(2).
            let grid = new Array(WORLD_CELLS);
            for (let index = 0; index < WORLD_CELLS; index++) {
                grid[index] = new Array(WORLD_CELLS);
            }

            // Place a first (non-random) tree.
            let treeX = 0;
            let treeY = MAX_TREE_DIST;
            let treePos = new Phaser.Math.Vector2(treeX, treeY);
            trees.push(new Tree(this, "trees", treePos));

            // Mark this tree (index 0 in the trees array) on the grid.
            let xCell = worldToGrid(treeX);
            let yCell = worldToGrid(treeY);
            grid[xCell][yCell] = 0;

            // Initialise the list of active trees (those that can be used as
            // the starting point for placing a new tree nearby, but not too
            // near).
            let activeList = [treePos];

            // While there are still active trees, pick one at random and
            // try to place a new tree near it.
            while (activeList.length > 0) {
                let startIndex = Phaser.Math.Between(0, activeList.length - 1);
                let startPos = activeList[startIndex];
                let startXCell = worldToGrid(startPos.x);
                let startYCell = worldToGrid(startPos.y);

                let tries = 0;
                let placed = false;
                while (!placed && tries < MAX_TRIES) {
                    let xOffset = (R * (Math.random() + 1) *
                                   Phaser.Math.RND.sign());
                    let yOffset = (R * (Math.random() + 1) *
                                   Phaser.Math.RND.sign());
                    let tryPos = new Phaser.Math.Vector2(xOffset, yOffset);
                    tryPos.add(startPos);

                    // Weed out attempts that are outside the grid.
                    let tryXCell = worldToGrid(tryPos.x);
                    let tryYCell = worldToGrid(tryPos.y);
                    if (tryXCell < 0 || tryXCell >= WORLD_CELLS ||
                        tryYCell < 0 || tryYCell >= WORLD_CELLS) {
                        tries++;
                        continue;
                    }
                    // This should have also weeded out any trees more than the
                    // desired distance from the bunker... except for literal
                    // corner cases, where the grid corners are further than
                    // the edges. Let's also remove  any candidates that are
                    // too close to the bunker.
                    if (tryPos.length() > MAX_TREE_DIST ||
                        tryPos.length() < MIN_TREE_DIST) {
                        tries++;
                        continue;
                    }

                    // Is this too close to an existing tree? Search the cells
                    // nearest to the start cell.
                    let tooClose = false;
                    for (let xStep = -MAX_CELL_STEP;
                         xStep <= MAX_CELL_STEP && !tooClose; xStep++) {
                        for (let yStep = -MAX_CELL_STEP;
                             yStep <= MAX_CELL_STEP && !tooClose; yStep++) {
                            // Is this cell actually the centre? Is it even
                            // on the grid?
                            if ((xStep === 0 && yStep === 0) ||
                                (startXCell + xStep < 0 ||
                                 startXCell + xStep >= WORLD_CELLS) ||
                                (startYCell + yStep < 0 ||
                                 startYCell + yStep >= WORLD_CELLS)) {
                                     continue;
                            }
                            // Okay, so it's a valid adjacent cell. Does it
                            // have a tree in it?
                            let maybeTreeIndex = grid[startXCell + xStep][startYCell + yStep];
                            if (typeof maybeTreeIndex !== "undefined") {
                                // Yes. Is the candidate too close to that
                                // tree?
                                if (tryPos.distance(trees[maybeTreeIndex].worldPos) < R) {
                                    // Yes.
                                    tooClose = true;
                                }
                            }
                        }
                    }
                    if (!tooClose) {
                        // It passed! Place a new tree there.
                        placed = true;
                        grid[tryXCell][tryYCell] = trees.length;
                        trees.push(new Tree(this, "trees", tryPos));
                        activeList.push(tryPos);
                    }
                    tries++;
                }
                if (!placed) {
                    // Ran out of tries. Remove this tree from the active list.
                    activeList.splice(startIndex, 1);
                }
            }
            return trees;
        },

        addEnemy: function () {
            if (typeof this.werewolfHowl !== "undefined") {
                this.werewolfHowl.play();
            }
            let bearing = Phaser.Math.DEG_TO_RAD * Phaser.Math.RND.angle();
            let pos = new Phaser.Math.Vector2(0, 0);
            pos.setToPolar(bearing, 2);
            let enemy = new Enemy(this, "werewolf", "wolfLeft",
                                  "wolfRight", "wolfAt", pos);
            enemy.setDepth(0);
            enemies.add(enemy, true);
            console.log("Enemy spawned");

            return enemy;
        },

        addFriendly: function () {
            let bearing = Phaser.Math.DEG_TO_RAD * Phaser.Math.RND.angle();
            let pos = new Phaser.Math.Vector2(0, 0);
            pos.setToPolar(bearing, HUMAN_SPAWN_DISTANCE);
            let friendly = new Friendly(this, "runner", "runLeft", "runRight",
                                        "runAt", pos);
            friendly.setDepth(0);
            friendlies.add(friendly, true);
            console.log("Human spawned");

            humanDelay = HUMAN_DELAY * 1000;

            return friendly;
        },

        savedFriendly: function () {
            this.bunkerSound.play();
            this.registry.inc("score", 50);
            if (friendlies.getLength() < 1) {
                this.addFriendly();
            }
        },

        shoot: function () {
            if (this.scene.shotCooldown <= 0) {
                this.scene.shotSound.play();
                this.scene.shotCooldown = SHOT_DELAY;

                this.scene.muzzleFlash.play("flash");

                // Are there any friendlies, enemies, or trees in the line of
                // fire?
                let hitObject = null;
                let killzone = new Phaser.Geom.Rectangle(-KILLZONE_WIDTH / 2,
                                                         -KILLZONE_LENGTH,
                                                         KILLZONE_WIDTH,
                                                         KILLZONE_LENGTH);
                let pos = new Phaser.Math.Vector2(0, 0);
                for (let f = 0; f < friendlies.getLength(); f++) {
                    let friendly = friendlies.getChildren()[f];
                    // Get this friendly's position.
                    pos.copy(friendly.worldPos);
                    // Rotate it to our frame of reference.
                    pos.rotate(-player.rot * Phaser.Math.DEG_TO_RAD);
                    if (killzone.contains(pos.x, pos.y)) {
                        if (hitObject === null ||
                            friendly.worldPos.length() <
                            hitObject.worldPos.length()) {
                                hitObject = friendly;
                            }
                    }
                }
                for (let e = 0; e < enemies.getLength(); e++) {
                    let enemy = enemies.getChildren()[e];
                    // Get this enemy's position.
                    pos.copy(enemy.worldPos);
                    // Rotate it to our frame of reference.
                    pos.rotate(-player.rot * Phaser.Math.DEG_TO_RAD);
                    if (killzone.contains(pos.x, pos.y)) {
                        if (hitObject === null ||
                            enemy.worldPos.length() <
                            hitObject.worldPos.length()) {
                                hitObject = enemy;
                            }
                    }
                }
                // TODO: Put trees in an iterable, too!
/*                for (let t = 0; t < trees.getLength(); t++) {
                    let tree = trees.getChildren()[t];
                    // Get this tree's position.
                    pos.copy(tree.worldPos);
                    // Rotate it to our frame of reference.
                    pos.rotate(-player.rot * Phaser.Math.DEG_TO_RAD);
                    if (killzone.contains(pos.x, pos.y)) {
                        if (hitObject === null ||
                            tree.worldPos.length() <
                            hitObject.worldPos.length()) {
                                hitObject = tree;
                            }
                    }
                }*/
                if (hitObject !== null) {
                    hitObject.shot();
                }
            }
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

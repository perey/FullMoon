(function () {
    "use strict";

    // The size in pixels of the game area.
    const WIDTH = 800;
    const HEIGHT = 600;

    // Player data.
    var Player = new Phaser.Class({
        initialize: function Player() {
            this.rot = 0.0;
        }
    })

    var player;

    // Game objects.

    // The moon.
    var Moon = new Phaser.Class({
        Extends: Phaser.GameObjects.Image,

        initialize: function Moon(scene, image, speed) {
            Phaser.GameObjects.Image.call(this, scene, WIDTH / 2.0,
                                           HEIGHT / 2.0, image);
            this.setDisplaySize(100, 100);
            this.setVisible(true);
        }
    });

    // An immobile item of scenery.
    var Scenery = new Phaser.Class({
        Extends: Phaser.GameObjects.Image,

        initialize: function Scenery(scene, sheet, frame, width, height,
                                     r, theta) {
            Phaser.GameObjects.Image.call(this, scene, 0, 0, sheet,
                                          frame);
            this.setDisplaySize(width, height);
            this.r = r;
            this.theta = theta;
            this.updatePosition();
        },

        updatePosition: function () {
            let x = this.theta;
            let y = HEIGHT / 2.0;
            this.setPosition(x, y);
        }
    });

    // A collection of Scenery instances.
    var scenery;

    // Phaser Scene functions.

    /**
     * Preload the game assets.
     */
    function preload() {
        this.load.image("background", "./assets/night-sky.png");
        this.load.image("ground", "./assets/ground.png");
        this.load.image("moon", "./assets/moon.png");
        this.load.spritesheet("trees", "./assets/trees.png",
                              {frameWidth: 150, frameHeight: 200});
    }

    /**
     * Create the game state after loading is complete.
     */
    function create() {
        player = new Player();

        let bg = this.add.image(0, 0, "background");
        bg.setOrigin(0, 0);
        bg.setDisplaySize(WIDTH, HEIGHT);

        let moon = new Moon(this, "moon", 0);
        this.add.existing(moon);

        let ground = this.add.image(0, HEIGHT / 2.0, "ground");
        ground.setOrigin(0, 0);
        ground.setDisplaySize(WIDTH, HEIGHT / 2.0);

        scenery = this.add.group({
            classType: Scenery,
            runChildUpdate: true
        });
        // Create some random trees.
        const availableDesigns = this.textures.get("trees").frameTotal;
        let trees = [];
        for (let i = 0; i < 3; i++) {
            let randomDesign = Math.round(availableDesigns * Math.random());
            let tree = new Scenery(this, "trees", randomDesign,
                                   150, 200, WIDTH * Math.random(),
                                   HEIGHT * Math.random());
            trees.push(tree);
        }
        scenery.addMultiple(trees, true);
    };

    /**
     * Update the game state.
     *
     * Parameters:
     *   time - The current time, in milliseconds
     *   delta - The time in milliseconds since the last frame
     */
    function update(time, delta) {
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

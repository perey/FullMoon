(function () {
    "use strict";

    // The size in pixels of the game area.
    const WIDTH = 800;
    const HEIGHT = 600;

    // Phaser Scene functions.

    /**
     * Preload the game assets.
     */
    function preload() {
        this.load.image("background", "./assets/night-sky.png");
        this.load.image("moon", "./assets/moon.png");
    }

    /**
     * Create the game state after loading is complete.
     */
    function create() {
        var bg = this.add.sprite(0, 0, "background");
        bg.setOrigin(0, 0);
        bg.setDisplaySize(WIDTH, HEIGHT);

        this.moon = this.add.sprite(WIDTH / 2.0, HEIGHT / 2.0, "moon");
        this.moon.setDisplaySize(100, 100);
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

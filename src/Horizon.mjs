const fs = require('fs');
const tmp = require('tmp');
const Jimp = require('jimp');

const SCALES = {
    pentatonic: [1, 3, 5, 7, 9]
};

const gmErrHandler = (...args) => console.error(args);

module.exports = class Horizon {
    constructor(opts = {}) {
        this.octaves = opts.ocatves || 7;
        this.scale = SCALES[opts.scale || 'pentatonic'];
        this.staveX = opts.x || 100;
        this.staveY = this.octaves * this.scale.length;
        this.outputPath = opts.outputPath || 'output.png';
        this.input = opts.input;
        this.px = [...new Array(this.staveX)].map(x => new Array(this.staveY));

        if (!fs.existsSync(this.input)) {
            throw new TypeError('input file does not exist at ' + this.input);
        }
    }

    debug() {
        console.log(this.img);
        // this.img.write(this.outputPath, gmErrHandler);
        console.log(this.outputPath);
    }

    async prepare() {
        console.log('resize %d x %d', this.staveX, this.staveY);
        this.img = await Jimp.read(this.input);
        await this.img
            .contrast(.1)
            .greyscale()
            .resize(this.staveX, this.staveY)
            .autocrop(.1, false)
            .write(this.outputPath);
    };

    async getData() {
        for (let x = 0; x < this.img.bitmap.width; x++) {
            // High to low
            for (let y = 0; y < this.img.bitmap.height; y++) {
                this.px[x][y] = Jimp.intToRGBA(
                    this.img.getPixelColor(x, y)
                ).r;
            }
        }
        console.dir(this.px)
    }
}

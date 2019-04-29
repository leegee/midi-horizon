const fs = require('fs');
const Jimp = require('jimp');
const MidiWriter = require('midi-writer-js');

const SCALES = {
    pentatonic: ["A", "C", "D", "E", "G"]
};

const gmErrHandler = (...args) => console.error(args);

module.exports = class Horizon {
    /**
     * 
     * @param opts {Object} options
     * @param opts.input {string} Path to input image file.
     * @param opts.outputMidi {string} Path to output file - defaults in input path with a suffix of `.mid`
     * @param opts.octaves {number=7} Number of octaves to use
     * @param opts.scale {string=pentatonic} Invariable atm
     * @param opts.x  {number?} Number of time slots (beats?)
     * @param opts.timeFactor {number} Multiplier for MIDI ticks.
     * @param opts.contrast {number} Range 0 - 1;
     * @param opts.minVelocity {number=0} Ignore pixels below this intensity (range 0-100)
     */
    constructor(opts = {}) {
        this.minVelocity = opts.minVelocity || 10;
        this.octaves = opts.octaves || 7;
        this.scale = SCALES[opts.scale || 'pentatonic'];
        this.staveX = opts.x || null;
        this.staveY = this.octaves * this.scale.length;
        this.outputMidi = opts.outputMidi || opts.input;
        this.outputMidi = this.outputMidi.replace(/\.mid$/);
        this.input = opts.input;
        this.outputImgPath = this.input + '_tmp.png';
        this.timeFactor = opts.timeFactor || 25;
        this.contrast = 0.5;

        if (!fs.existsSync(this.input)) {
            throw new TypeError('input file does not exist at ' + this.input);
        }
    }

    async prepare() {
        this.img = await Jimp.read(this.input);
        if (this.staveX === null) {
            this.staveX = this.img.bitmap.width;
        }

        this.px = [...new Array(this.staveX)].map(x => new Array(this.staveY));

        await this.img
            .flip(false, true)
            .contrast(this.contrast)
            .greyscale()
            .resize(this.staveX * 2, this.staveY * 2, Jimp.RESIZE_NEAREST_NEIGHBOR)
            .autocrop(.1, false)
            .resize(this.staveX, this.staveY, Jimp.RESIZE_NEAREST_NEIGHBOR)
            .invert()
            .write(this.outputImgPath);

        console.assert(this.staveX === this.img.bitmap.width);
        console.assert(this.staveY === this.img.bitmap.height);
    };

    async getData() {
        for (let x = 0; x < this.staveX; x++) {
            for (let y = 0; y < this.staveY; y++) {
                this.px[x][y] = Jimp.intToRGBA(
                    this.img.getPixelColor(x, y)
                ).r;
                // throw this.px[x][y];
            }
        }
    }

    linear() {
        // this.tracks = new Array(this.staveX).fill(new MidiWriter.Track());
        this.track = new MidiWriter.Track();

        for (let x = 0; x < this.staveX; x++) {
            const start = (x + 1) * this.timeFactor;

            for (let y = 0; y < this.staveY; y++) {
                const velocity = (this.px[x][y] / 255) * 100;
                if (velocity > this.minVelocity) {
                    const pitch = y % this.scale.length;
                    const octave = Math.floor(y / this.scale.length) + 1;
                    this.track.addEvent(
                        new MidiWriter.NoteEvent({
                            pitch: this.scale[pitch] + octave,
                            velocity: velocity,
                            duration: 'T' + this.timeFactor,
                            startTick: start
                        })
                    );

                }
            }
        }
    }

    save() {
        const write = new MidiWriter.Writer(this.track);
        write.saveMIDI(this.outputMidi);
        return this.outputMidi + '.mid';
    }
}

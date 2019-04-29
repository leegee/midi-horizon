const path = require('path');
const fs = require('fs');
const Jimp = require('jimp');
const MidiWriter = require('midi-writer-js');

const SCALES = {
    pentatonic: ["A", "C", "D", "E", "G"]
};

const MOD_SUFFIX = '_tmp.png';
const OUR_MOD = new RegExp(MOD_SUFFIX + '$');
const WANTED_FILES = /\.(jpg|jpeg|png)$/i;

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
        this.contrast = 0.5;
        this.transposeOctave = 2;
        this.input = opts.input;
        this.minVelocity = opts.minVelocity || 10;
        this.octaves = opts.octaves || 7;
        this.scale = SCALES[opts.scale || 'pentatonic'];
        this.staveX = opts.x || null;
        this.staveY = this.octaves * this.scale.length;
        this.outputImgPath = this.input + MOD_SUFFIX;
        this.timeFactor = opts.timeFactor || 25;
        this.outputMidi = opts.outputMidi || opts.input;

        //if (fs.existsSync(this.outputImgPath)){
        //    fs.unlinkSync(this.outputImgPath);
        //}
        // if (fs.existsSync(this.outputMidi)){
        //     fs.unlinkSync(this.outputMidi);
        // }
        this.outputMidi = this.outputMidi.replace(/\.mid$/);

        if (!fs.existsSync(this.input)) {
            throw new TypeError('input file does not exist at ' + this.input);
        }
    }

    do() {
        this._getPixels();
        this.linear();
        this.save();
    }

    static async doDir(options = {}) {
        const createdHorizons = await Horizon.dir2horizons(options);
        createdHorizons.forEach(h => {
            h.do();
        });
        return createdHorizons;
    }

    static async dir2horizons(options = {}) {
        const createdHorizons = [];
        const dir = options.input;
        const pendingHorizons = [];

        if (!options.input || !fs.existsSync(options.input)) {
            throw new Error('Supply "input" arg as dir of files to parse.');
        }

        fs.readdirSync(
            options.input,
            { withFileTypes: true }
        ).forEach(async (entry) => {
            if (entry.isFile() &&
                entry.name.match(WANTED_FILES) &&
                !entry.name.match(OUR_MOD)
            ) {
                const h = new Horizon({
                    ...options,
                    input: path.resolve(dir + '/' + entry.name)
                });
                pendingHorizons.push(h.load());
                createdHorizons.push(h);
            }
        });
        await Promise.all(pendingHorizons);
        return createdHorizons;
    }

    async load() {
        this.img = await Jimp.read(this.input);
        if (this.staveX === null) {
            this.staveX = this.img.bitmap.width;
        }

        this.px = [...new Array(this.staveX)].map(x => new Array(this.staveY));

        await this.img
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

    async _getPixels() {
        for (let x = 0; x < this.staveX; x++) {
            for (let y = 0; y < this.staveY; y++) {
                this.px[x][this.staveY - y] = Jimp.intToRGBA(
                    this.img.getPixelColor(x, y)
                ).r;
            }
        }
    }

    linear() {
        this.notes = [...new Array(this.staveX)].map(x => new Array(this.staveY));

        for (let x = 0; x < this.staveX; x++) {
            const start = (x + 1) * this.timeFactor;

            for (let y = 0; y < this.staveY; y++) {
                const velocity = (this.px[x][y] / 255) * 100;
                if (velocity > this.minVelocity) {
                    const pitch = y % this.scale.length;
                    const octave = Math.floor(y / this.scale.length) + this.transposeOctave;
                    this.notes[x][y] = {
                        pitch: this.scale[pitch] + octave,
                        velocity: velocity,
                        duration: 1,
                        startTick: start
                    };
                }
            }
        }

        // Proc durations: sustain notes of same pitch and velocity
        for (let y = 0; y < this.staveY; y++) {
            for (let x = 0; x < this.staveX; x++) {
                // Search along x for same notes, and extend the first
                const startX = x;
                while (x < this.staveX - 1 &&
                    this.notes[x][y] && this.notes[x + 1][y] &&
                    this._sameNote(this.notes[x][y], this.notes[x + 1][y])
                ) {
                    this.notes[startX][y].duration += 1;
                    if (x > startX) {
                        delete this.notes[x][y];
                    }
                    x++;
                }
            }
        }
    }

    _sameNote(a, b) {
        return a.pitch === b.pitch && a.velocity === b.velocity;
    }

    save() {
        this.track = new MidiWriter.Track();
        for (let x = 0; x < this.staveX; x++) {
            for (let y = 0; y < this.staveY; y++) {
                if (this.notes[x][y]) {
                    this.notes[x][y].duration = 'T' +
                        (this.timeFactor * this.notes[x][y].duration);
                    this.track.addEvent(
                        new MidiWriter.NoteEvent(this.notes[x][y])
                    );
                }
            }
        }

        const write = new MidiWriter.Writer(this.track);
        write.saveMIDI(this.outputMidi);
        return this.outputMidi + '.mid';
    }
}


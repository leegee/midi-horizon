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
     * @param opts.output {string} Path to output directory 
     * @param opts.octaves {number=7} Number of octaves to use
     * @param opts.scale {string=pentatonic} Invariable atm
     * @param opts.x  {number?} Number of time slots (beats?)
     * @param opts.timeFactor {number} Multiplier for MIDI ticks.
     * @param opts.contrast {number} Range 0 - 1.
     * @param opts.cropTolerance {number} Range 0 - 1.
     * @param opts.velocityScaleMax {number} Scale velocities to smaller ceilings to remove precision/steps.
     * @param opts.minVelocityPostScale {number=0} Ignore pixels below this intensity (range 0-100)
     */
    constructor(opts = {}) {
        if (!opts.output) {
            throw new TypeError('output dir not specified.');
        }
        if (!opts.input) {
            throw new TypeError('input file not specified.');
        }
        if (!fs.existsSync(opts.input)) {
            throw new TypeError('input file does not exist at ' + this.input);
        }

        this.contrast = 0.5;
        this.transposeOctave = 2;
        this.input = opts.input;
        this.octaves = opts.octaves || 7;
        this.scale = SCALES[opts.scale || 'pentatonic'];
        this.staveX = opts.x || null;
        this.staveY = this.octaves * this.scale.length;
        this.outputImgPath = this.output + MOD_SUFFIX;
        this.timeFactor = opts.timeFactor || 25;
        const inputFilename = this.input.match(/([^\/]+)\/?$/);
        this.outputMidi = opts.output + '/' + inputFilename + '.mid';
        this.cropTolerance = opts.cropTolerance || 0.2;
        this.velocityScaleMax = opts.velocityScaleMax || 127;
        this.minVelocityPostScale = opts.minVelocityPostScale || 2;

        if (fs.existsSync(this.outputImgPath)) {
            fs.unlinkSync(this.outputImgPath);
        }
        if (fs.existsSync(this.outputMidi)) {
            fs.unlinkSync(this.outputMidi);
        }
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
            options.output,
            { withFileTypes: true }
        ).forEach(async (entry) => {
            if (entry.isFile() &&
                entry.name.match(WANTED_FILES) &&
                !entry.name.match(OUR_MOD)
            ) {
                const h = new Horizon({
                    ...options,
                    input: path.resolve(dir + '/' + entry.name),
                    output: path.resolve(options.output + '/' + entry.name),
                });
                pendingHorizons.push(h.load());
                createdHorizons.push(h);
            }
        });
        await Promise.all(pendingHorizons);
        return createdHorizons;
    }

    scaleVelocity(pixelValue) {
        if (pixelValue > 256) {
            throw new RangeError('pixelValue ' + pixelValue + ' out of range.');
        }
        return Math.floor(((pixelValue) / 255) * this.velocityScaleMax);
    }

    do() {
        this._getPixels();
        this._linear();
        this._saveAsOneTrack();
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
            .autocrop(this.cropTolerance, false)
            .resize(this.staveX, this.staveY, Jimp.RESIZE_NEAREST_NEIGHBOR)
            .invert()
            .write(this.outputImgPath);

        console.assert(this.staveX === this.img.bitmap.width);
        console.assert(this.staveY === this.img.bitmap.height);
    };

    _getPixels() {
        for (let x = 0; x < this.staveX; x++) {
            for (let y = 0; y < this.staveY; y++) {
                this.px[x][this.staveY - y] = Jimp.intToRGBA(
                    this.img.getPixelColor(x, y)
                ).r;
            }
        }
    }

    _linear() {
        this.notes = [...new Array(this.staveX)].map(x => new Array(this.staveY));

        for (let x = 0; x < this.staveX; x++) {
            const startTick = x * this.timeFactor;

            for (let y = 0; y < this.staveY; y++) {
                const velocity = this.scaleVelocity(this.px[x][y]);
                if (velocity > this.minVelocityPostScale) {
                    const pitch = y % this.scale.length;
                    const octave = Math.floor(y / this.scale.length) + this.transposeOctave;
                    this.notes[x][y] = {
                        pitch: this.scale[pitch] + octave,
                        velocity: velocity,
                        duration: 1,
                        startTick: startTick
                    };
                }
            }
        }

        this._sustainAdjacentNotes();
        // this._getNoteDensities();
    }

    _getHighestNotes() {
        this.highestNotes = []

        for (let x = 0; x < this.staveX; x++) {
            for (let y = this.staveY; y >= 0; y--) {
                if (this.notes[x][y] && this.notes[x][y - 1]) {
                    // Require the note to have another below to avoid noise:
                    this.highestNotes.push(this.notes[x][y]);
                    break;
                }
            }
        }
    }

    _getNoteDensities() {
        this.totalDuration = new Array(this.staveX).fill(0);
        this.hits = new Array(this.staveX).fill(0);

        for (let y = 0; y < this.staveY; y++) {
            for (let x = 0; x < this.staveX; x++) {
                if (this.notes[x][y]) {
                    this.totalDuration[y] += this.notes[x][y].duration;
                    this.hits[y]++;
                }
            }
        }
    }

    // Proc durations: sustain notes of same pitch and velocity
    _sustainAdjacentNotes() {
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

    _normaliseDuration(note) {
        note.duration = 'T' + (this.timeFactor * note.duration);
    }

    _saveHighestNotes() {
        this.track = new MidiWriter.Track();

        if (!this.highestNotes || this.highestNotes.length === 0) {
            throw new Error('No highestNotes to save.');
        }

        this.track = new MidiWriter.Track();
        this.highestNotes.forEach(note => {
            this._normaliseDuration(note);
            this.track.addEvent(
                new MidiWriter.NoteEvent(note)
            );
        });

        const write = new MidiWriter.Writer(this.track);
        this.outputMidi = this.outputMidi.replace(/\.mid/, '_hi.mid');
        const path = this.outputMidi.replace(/\.mid$/, '');
        write.saveMIDI(path);
        return this.outputMidi;
    }

    _saveAsOneTrack() {
        this.track = new MidiWriter.Track();
        for (let x = 0; x < this.staveX; x++) {
            for (let y = 0; y < this.staveY; y++) {
                if (this.notes[x][y]) {
                    this._normaliseDuration(this.notes[x][y]);
                    this.track.addEvent(
                        new MidiWriter.NoteEvent(this.notes[x][y])
                    );
                }
            }
        }

        const write = new MidiWriter.Writer(this.track);
        const path = this.outputMidi.replace(/\.mid$/, '');
        write.saveMIDI(path);
        return this.outputMidi;
    }
}


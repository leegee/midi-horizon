const path = require('path');
const fs = require('fs');

var log4js = require('log4js');
const Jimp = require('jimp');
const MidiWriter = require('midi-writer-js');

const SCALES = {
    pentatonic: ["A", "C", "D", "E", "G"]
};

const MOD_SUFFIX = '_tmp.png';
const OUR_PROCESSED_IMAGE_FILE = new RegExp(MOD_SUFFIX + '$');
const WANTED_IMAGE_FILES = /\.(jpg|jpeg|png)$/i;
const HUE = 0;
const SATURATION = 1;
const LIGHTNESS = 2;

module.exports = class Horizon {
    /**
     * 
     * @param options {Object} options
     * @param options.input {string} Path to input image file.
     * @param options.output {string} Path to output directory 
     * @param options.octaves {number=7} Number of octaves to use
     * @param options.scale {string=pentatonic} Invariable atm
     * @param options.x  {number?} Number of time slots (beats?)
     * @param options.timeFactor {number} Multiplier for MIDI ticks.
     * @param options.transposeOctave {number=2} 
     * @param options.contrast {number=0.5} Range 0 - 1.
     * @param options.cropTolerance {number} Range 0 - 1.
     * @param options.velocityScaleMax {number} Scale velocities to smaller ceilings to remove precision/steps.
     * @param options.minVelocityPostScale {number=0} Ignore pixels below this intensity (range 0-100)
     */
    constructor(options = {}) {
        if (!options.output) {
            throw new TypeError('output dir not specified.');
        }
        if (!options.input) {
            throw new TypeError('input file not specified.');
        }
        if (!fs.existsSync(options.input)) {
            throw new TypeError('input file does not exist at ' + this.input);
        }

        this.logger = options.logger || log4js.getLogger();

        this._setPaths(options);

        this.contrast = 0.5;
        this.transposeOctave = options.transposeOctave || 2;
        this.octaves = options.octaves || 7;
        this.scale = SCALES[options.scale || 'pentatonic'];
        this.staveX = options.x || null;
        this.staveY = this.octaves * this.scale.length;
        this.timeFactor = options.timeFactor || 24;
        this.cropTolerance = options.cropTolerance || 0.2;
        this.velocityScaleMax = options.velocityScaleMax || 127;
        this.minVelocityPostScale = options.minVelocityPostScale || 2;
    }

    _setPaths(options) {
        this.input = path.resolve(options.input);
        this.output = path.resolve(options.output);
        this._inputFilename = this.input.match(/([^\\\/]+)[\\\/]*$/)[1]; // path.posix.basename(this.input);
        this._outputDir = this.output.match(/\.\w+$/) === null ? this.output : path.dirname(this.output);
        this.outputImgPath = path.join(this._outputDir, this._inputFilename + MOD_SUFFIX);
        this.outputMidiPath = path.join(this._outputDir, this._inputFilename + '.mid');
    }

    static rgb2hsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (min + max) / 2;
        let h = 0;
        let s = 0;

        if (max !== min) {
            const delta = max - min;
            s = l >= 0.5 ? delta / (2 - max - min) : delta / (min + max);
            switch (max) {
                case r:
                    h = (g - b) / delta + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / delta + 2;
                    break;
                case b:
                    h = (r - g) / delta + 4;
                    break;
            }
            h /= 6;
        }

        return [h, s, l];
    }

    static async doDirHighestNotes(options = {}) {
        const createdHorizons = await Horizon.dir2horizons(options);
        createdHorizons.forEach(h => {
            h.doHighestNotes();
        });
        return createdHorizons;
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

        if (!dir || !fs.existsSync(dir)) {
            throw new Error('Supply "input" arg as dir of files to parse.');
        }

        fs.readdirSync(
            dir,
            { withFileTypes: true }
        ).forEach(async (entry) => {
            if (entry.isFile() &&
                entry.name.match(WANTED_IMAGE_FILES) &&
                !entry.name.match(OUR_PROCESSED_IMAGE_FILE)
            ) {
                const h = new Horizon({
                    ...options,
                    input: path.resolve(dir + '/' + entry.name),
                    output: path.resolve(options.output + '/' + entry.name),
                });
                const x = h.load();
                createdHorizons.push(h);
            }
        });
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

    doHighestNotes() {
        this._getPixels();
        this._linear();
        this._getHighestNotes();
        this._saveHighestNotes();
    }

    async load() {
        this.img = await Jimp.read(this.input);
        if (this.staveX === null) {
            this.staveX = this.img.bitmap.width;
        }

        this.px = [...new Array(this.staveX)].map(x => new Array(this.staveY));

        await this.img
            .contrast(this.contrast);

        this.imgClr = this.img.clone();

        await this.img.greyscale();

        await Promise.all([
            this._resize(this.img),
            this._resize(this.imgClr)
        ]);

        console.assert(this.staveX === this.img.bitmap.width);
        console.assert(this.staveY === this.img.bitmap.height);
    };

    _resize(image) {
        return image.resize(this.staveX * 2, this.staveY * 2, Jimp.RESIZE_NEAREST_NEIGHBOR)
            .autocrop(this.cropTolerance, false)
            .resize(this.staveX, this.staveY, Jimp.RESIZE_NEAREST_NEIGHBOR)
            .invert()
            .write(this.outputImgPath);
    }


    _getPixels() {
        for (let x = 0; x < this.staveX; x++) {
            for (let y = 0; y < this.staveY; y++) {
                const rgb = Jimp.intToRGBA(
                    this.img.getPixelColor(x + 1, y + 1)
                );
                this.px[x][this.staveY - 1 - y] = rgb.r;
                // this.colours[x][this.staveY - y] = Horizon.rgb2hsl(rgb.r, rgb.g, rgb.b)[LIGHTNESS] * 255;
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

    _getHighestNotes(wantFriends = true) {
        this.highestNotes = [];
        this.logger.warn(`Get highest notes, with friends? ${wantFriends}`);

        for (let x = 0; x < this.staveX; x++) {
            for (let y = this.staveY; y >= 0; y--) {
                let neighboured = wantFriends ? this.notes[x][y - 1] : true;

                if (this.notes[x][y] && neighboured) {
                    // Require the note to have another below to avoid noise:
                    this.highestNotes.push(this.notes[x][y]);
                    break;
                }
            }
        }

        if (this.highestNotes.length === 0) {
            this.logger.warn('Found no highest notes');
            if (wantFriends) {
                this.logger.warn('Trying again without asking for friends.');
                this._getHighestNotes(false);
            } else {
                // this.logger.warn(JSON.stringify(this.px));
                throw new Error('Found no highest notes, even lonely ones.');
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
        this.outputMidiPath = this.outputMidiPath.replace(/\.mid$/, '_hi.mid');
        write.saveMIDI(
            this.outputMidiPath.replace(/\.mid$/, '')
        );
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
        write.saveMIDI(
            this.outputMidiPath.replace(/\.mid$/, '')
        );
    }
}


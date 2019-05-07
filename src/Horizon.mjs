const path = require('path');
const fs = require('fs');

var log4js = require('log4js');
const Jimp = require('jimp');
const MidiWriter = require('midi-writer-js');
const Chord = require("tonal-chord")

const Bresenham_Points = [
    [3, 0],
    [0, 3],
    [-3, 0],
    [0, -3],
    [3, 1],
    [1, 3],
    [-3, 1],
    [-1, 3],
    [-3, -1],
    [-1, -3],
    [1, -3],
    [2, 2],
    [-2, 2],
    [2, -2],
];


const SCALES = {
    pentatonic: ["A", "C", "D", "E", "G"],
    major: ["C", "D", "E", "F", "G", "A", "B"]
};

const CHORDS = {
    pentatonic: ["Am", "C", "Dm", "E", "G"],
    major: ["C", "Dm", "Em", "F", "G", "Am", "Bdim"]
};

const MAX_OCTAVES = 8;
const MOD_SUFFIX = '_tmp.png';
const OUR_PROCESSED_IMAGE_FILE = new RegExp(MOD_SUFFIX + '$');
const WANTED_IMAGE_FILES = /\.(jpg|jpeg|png)$/i;
const HUE = 0;
const SATURATION = 1;
const LIGHTNESS = 2;

const DEFAULT_OPTIONS = {
    contrast: 0.5,
    transposeOctave: 1,
    timeFactor: 24,
    cropTolerance: 0.2,
    velocityScaleMax: 127,
    minUnscaledVelocity: 0.2,
    velocityMatchThreshold: 0.2,
    scaleName: 'pentatonic',
    staveX: null,
    logger: log4js.getLogger(),
    bresenhamPointsThreshold: 0.5,
    blurPixels: 1
};

class Horizon {
    /**
     * 
     * @param options {Object} options
     * @param options.input {string} Path to input image file.
     * @param options.output {string} Path to output directory 
     * @param options.octaves {number=7} Number of octaves to use
     * @param options.scale {Array<string>} A, B, C, etc
     * @param options.scaleName {string=pentatonic} Invariable atm
     * @param options.staveX  {number?} Number of time slots (beats?)
     * @param options.timeFactor {number} Multiplier for MIDI ticks.
     * @param options.transposeOctave {number=2} 
     * @param options.contrast {number=0.5} Range 0 to 1.
     * @param options.cropTolerance {number} Range 0 to 1.
     * @param options.velocityScaleMax {number} Scale velocities to smaller ceilings to remove precision/steps.
     * @param options.minUnscaledVelocity {number=0} Ignore pixels below this intensity (range 0-100)
     * @param options.velocityMatchThreshold {number=.2} Range 0 to 1
     * @param options.bresenhamPointsThreshold {number=0.5} Range 0 to 1
     * @param options.blurPixels {number=1}
     */
    constructor(options) {
        this._setPaths(options);

        Object.keys(DEFAULT_OPTIONS).forEach(
            key => {
                this[key] = options.hasOwnProperty(key) ? options[key] : DEFAULT_OPTIONS[key]
            }
        );

        this.octaves = (options.octaves || MAX_OCTAVES) + this.transposeOctave;
        this.scale = SCALES[this.scaleName];
        this.chords = CHORDS[this.scaleName];
        this.staveY = MAX_OCTAVES * this.scale.length;
        this.img = null;
    }

    static sum(subject) {
        return subject.reduce(
            (a, b) => { return a + b },
            0
        );
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
        Horizon.doDir(options, 'doHighestNotes');
    }

    static async doDirColours(options = {}) {
        Horizon.doDir(options, 'doColours');
    }

    static async doDir(options = {}, method) {
        const createdHorizons = await Horizon.dir2horizons(options);
        createdHorizons.forEach(h => {
            method ? h[method]() : h.do();
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
                h.load();
                createdHorizons.push(h);
            }
        });
        return createdHorizons;
    }

    do() {
        this._getPixels();
        this._linear();
        this._sustainAdjacentNotes(this.notes);
        this._saveAsOneTrack();
    }

    doHighestNotes() {
        this._getPixels();
        this._linear();
        this._getHighestNotes();
        this._sustainAdjacentNotes(this.highestNotes);
        this._saveHighestNotes();
    }

    doColours() {
        this._getPixels();
        this._linear();
        this._getHighestNotes();
        this._sustainAdjacentNotes(this.highestNotes);
        this._processColours();
        this._saveColouredHighestNotes();
    }

    async load() {
        this.img = await Jimp.read(this.input);
        if (this.staveX === null) {
            this.staveX = this.img.bitmap.width;
            this.logger.warn('Set staveX to ', this.img.bitmap.width);
        }

        this.colourImage = this.img.clone();

        await this.img.blur(this.blurPixels)
            .contrast(this.contrast)
            .greyscale();

        await Promise.all([
            this._resize(this.img),
            this._resize(this.colourImage)
        ]);

        await Promise.all([
            await this.img.invert().write(this.outputImgPath),
            await this.colourImage.write(this.outputClrImgPath)
        ]);

        console.assert(this.staveX === this.img.bitmap.width);
        console.assert(this.staveY === this.img.bitmap.height);
    };

    _resize(image) {
        return image.resize(this.staveX * 2, this.staveY * 2, Jimp.RESIZE_NEAREST_NEIGHBOR)
            .autocrop(this.cropTolerance, false)
            .resize(this.staveX, this.staveY, Jimp.RESIZE_NEAREST_NEIGHBOR)
    }

    _getPixels() {
        this.px = [...new Array(this.staveX)].map(x => new Array(this.staveY));
        this.colours = [...new Array(this.staveX)].map(x => new Array(this.staveY));

        for (let x = 0; x < this.img.bitmap.width; x++) {
            for (let y = 0; y < this.img.bitmap.height; y++) {
                const atY = this.staveY - 1 - y;
                this.px[x][atY] = Jimp.intToRGBA(
                    this.img.getPixelColor(x, y)
                ).r / 255;
                // console.log(this.px[x][atY], Jimp.intToRGBA( this.img.getPixelColor(x , y ) ));

                const rgb = Jimp.intToRGBA(
                    this.colourImage.getPixelColor(x, y)
                );
                const hsl = Horizon.rgb2hsl(rgb.r, rgb.g, rgb.b);
                // this.px[x][this.staveY - 1 - y] = rgb.r;
                this.colours[x][atY] = hsl;
            }
        }
    }

    _setPaths(options) {
        if (!options.output) {
            throw new TypeError('output dir not specified.');
        }
        if (!options.input) {
            throw new TypeError('input file not specified.');
        }
        if (!fs.existsSync(options.input)) {
            throw new TypeError('input file does not exist at ' + this.input);
        }

        this.input = path.resolve(options.input);
        this.output = path.resolve(options.output);
        this._inputFilename = this.input.match(/([^\\\/]+)[\\\/]*$/)[1]; // path.posix.basename(this.input);
        this._outputDir = this.output.match(/\.\w+$/) === null ? this.output : path.dirname(this.output);
        this.outputImgPath = path.join(this._outputDir, this._inputFilename + MOD_SUFFIX);
        this.outputClrImgPath = path.join(this._outputDir, this._inputFilename + '_clr_' + MOD_SUFFIX);
        this.outputMidiPath = path.join(this._outputDir, this._inputFilename + '.mid');
    }

    _normaliseVelocity(pixelValue) {
        if (pixelValue > Horizon.MAX_VELOCITY_IN_PIXEL) {
            throw new RangeError('pixelValue ' + pixelValue + ' should range 0 ' + Horizon.MAX_VELOCITY_IN_PIXEL);
        }
        if (isNaN(pixelValue)) {
            throw new RangeError(`Called with NaN: ${+ pixelValue}`);
        }
        // return Math.floor(((pixelValue) / Horizon.MAX_VELOCITY_IN_PIXEL) * this.velocityScaleMax);
        return Math.floor(pixelValue * this.velocityScaleMax);
    }

    _normaliseColour(lightness) {
        if (lightness > 1) {
            throw new RangeError('lightness ' + lightness + ' should range 0 to 1.');
        }
        return Math.floor(lightness * this.chords.length);
    }

    _normalisePitch(y) {
        const pitch = y % this.scale.length;
        const octave = Math.floor(y / this.scale.length) + this.transposeOctave;
        return this.scale[pitch] + octave;
    }

    _linear() {
        this.notes = [...new Array(this.staveX)].map(x => new Array(this.staveY));
        for (let x = 0; x < this.staveX; x++) {
            for (let y = 0; y < this.staveY; y++) {
                if (!this.px[x][y]) {
                    throw new Error('no pixel at ' + x + ',' + y);
                }
                this.notes[x][y] = {
                    pitch: this._normalisePitch(y),
                    velocity: this._normaliseVelocity(this.px[x][y]),
                    duration: 1,
                    startTick: x * this.timeFactor
                };
            }
        }
    }

    // forget friends
    _getHighestNotes() {
        this.highestNotes = new Array(this.staveX);
        for (let x = 0; x < this.staveX; x++) {
            for (let y = this.staveY - 1; y >= 0; y--) {
                if (this.notes[x][y]
                    && this.notes[x][y].velocity >= this.minUnscaledVelocity
                ) {
                    this.highestNotes[x] = this.notes[x][y];
                    break;
                }
            }
        }

        if (Horizon.sum(this.highestNotes) === 0) {
            this.logger.trace('Found no highest notes', this.notes);
            throw new Error('Found no highest notes! minUnscaledVelocity is ' + this.minUnscaledVelocity);
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

    // Look ahead for same (within a threshold) note, 
    // remote it, adding its duration to the initial note
    _sustainAdjacentChords() {
        for (let x = 1; x < this.averageColourChords.length; x++) {
            const noteToSustain = x - 1;
            while (
                this.averageColourChords[noteToSustain] &&
                this.averageColourChords[x] &&
                this._sameNote(
                    this.averageColourChords[noteToSustain],
                    this.averageColourChords[x]
                )
            ) {
                this.averageColourChords[noteToSustain].duration += this.averageColourChords[x].duration;
                delete this.averageColourChords[x];
                x++;
            }
        }
    }

    // Proc durations: sustain notes of same pitch and velocity
    _sustainAdjacentNotes(subject) {
        for (let y = 0; y < this.staveY; y++) {
            for (let x = 1; x < this.staveX; x++) {
                // Search along x for same notes, and extend the first
                const noteToSustain = x - 1;
                while (
                    subject[x] && subject[x][y] &&
                    this._sameNote(subject[noteToSustain][y], subject[x][y])
                ) {
                    subject[noteToSustain][y].duration += subject[x][y].duration
                    delete subject[x][y];
                    x++;
                }
            }
        }
    }

    _sameNote(a, b) {
        return Math.abs(a.velocity - b.velocity) < this.velocityMatchThreshold &&
            a.pitch instanceof Array ? a.pitch.join() === b.pitch.join() : a.pitch === b.pitch
    }

    _formatDuration(note) {
        if (typeof note.duration === 'number') {
            note.duration = 'T' + (this.timeFactor * note.duration);
        }
    }

    _saveAsOneTrack() {
        this.track = new MidiWriter.Track();
        for (let x = 0; x < this.staveX; x++) {
            for (let y = 0; y < this.staveY; y++) {
                if (this.notes[x][y]) {
                    this._formatDuration(this.notes[x][y]);
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
        this.logger.info(this.outputMidiPath);
    }

    _saveHighestNotes() {
        if (!this.highestNotes || Horizon.sum(this.highestNotes) === 0) {
            throw new Error('No highestNotes to save.');
        }

        this.track = new MidiWriter.Track();

        for (let x = 0; x < this.staveX; x++) {
            if (this.highestNotes[x]) {
                this._formatDuration(this.highestNotes[x]);
                this.track.addEvent(
                    new MidiWriter.NoteEvent(this.highestNotes[x])
                );
            }
        }

        const write = new MidiWriter.Writer(this.track);
        this.outputMidiPath = this.outputMidiPath.replace(/\.mid$/, '_hi.mid');
        write.saveMIDI(
            this.outputMidiPath.replace(/\.mid$/, '')
        );

        this.logger.info(this.outputMidiPath);
    }

    _saveColouredHighestNotes() {
        if (!this.highestNotes || Horizon.sum(this.highestNotes) === 0) {
            throw new Error('No highestNotes to save.');
        }
        if (!this.averageColourChords || Horizon.sum(this.averageColourChords) === 0) {
            throw new Error('No averageColourChords to save.');
        }

        this.checkPitches(this.highestNotes);

        const tracks = {
            highest: new MidiWriter.Track(),
            colours: new MidiWriter.Track(),
        };

        tracks.highest.addTrackName('Highest ' + this._inputFilename);
        tracks.colours.addTrackName('Colours ' + this._inputFilename);
        tracks.highest.setTimeSignature(1, 1, this.timeFactor);
        tracks.colours.setTimeSignature(1, 1);

        for (let x = 0; x < this.staveX; x++) {
            const startTick = 1 + (x * this.timeFactor);
            if (this.highestNotes[x]) {
                this._formatDuration(this.highestNotes[x]);
                tracks.highest.addEvent(
                    new MidiWriter.NoteEvent({
                        velocity: this.highestNotes[x].velocity,
                        duration: this.highestNotes[x].duration,
                        pitch: this.highestNotes[x].pitch,
                        startTick
                    })
                );
            }
            if (this.averageColourChords[x]) {
                this._formatDuration(this.averageColourChords[x]);

                tracks.colours.addEvent(
                    new MidiWriter.NoteEvent(
                        {
                            velocity: this.averageColourChords[x].velocity,
                            duration: this.averageColourChords[x].duration,
                            pitch: this.averageColourChords[x].pitch,
                            startTick
                        }
                    )
                );
            }
        }

        const write = new MidiWriter.Writer(
            Object.values(tracks)
        );
        this.outputMidiPath = this.outputMidiPath.replace(/\.mid$/, '_coloured.mid');
        write.saveMIDI(
            this.outputMidiPath.replace(/\.mid$/, '')
        );
        this.logger.info(this.outputMidiPath);
    }

    _processColours() {
        this.logger.trace('Enter _processColours');
        if (!this.colours || Horizon.sum(this.colours) === 0) {
            throw new Error('No highestNotes to save.');
        }

        this.averageColourChords = new Array(this.staveX);

        for (let x = 0; x < this.staveX; x++) {
            this.averageColourChords[x] = { colour: 0, velocity: 0, duration: 1, octave: 0 };

            for (let y = 0; y < this.staveY; y++) {
                this.averageColourChords[x].colour += this.colours[x][y][HUE];
                this.averageColourChords[x].velocity += this.colours[x][y][LIGHTNESS];
                this.averageColourChords[x].octave += 1 - this.colours[x][y][SATURATION];
            }

            this.averageColourChords[x].colour /= this.staveY;
            this.averageColourChords[x].velocity /= this.staveY;
            this.averageColourChords[x].octave = Math.floor(
                (this.averageColourChords[x].octave / (this.staveY / this.scale.length)) + 1
            );
            this.averageColourChords[x].velocity = this._normaliseVelocity(this.averageColourChords[x].velocity);

            const chord = this._colour2chordName(
                this.averageColourChords[x].colour,
                this.averageColourChords[x].octave
            );
            this.averageColourChords[x].pitch = Chord.notes(chord).map(
                note => note + this.averageColourChords[x].octave
            );

            if (chord === undefined) {
                console.warn(x, this.averageColourChords[x]);
                console.warn(x, this.highestNotes[x], chord, notes);
                throw new Error('No chord at ' + x);
            }

            if (this.averageColourChords[x].pitch === undefined) {
                throw new Error();
            }
        }

        this._sustainAdjacentChords();
    }

    _colour2chordName(colour, octave = 3) {
        if (isNaN(octave)) {
            throw new RangeError('octave is ' + octave);
        }
        const index = Math.round(colour * (this.chords.length - 1));
        return this.chords[index];
    }

    checkPitches(notes) {
        let tooHigh = false;
        for (let x = 0; x < notes.length; x++) {
            if (notes[x] && Number(notes[x].pitch.substr(1, 1)) > 7) {
                tooHigh = true;
            }
        }
        if (tooHigh) {
            notes = notes.map(note => {
                const octave = Number(note.pitch.substr(1, 1));
                note.pitch = note.pitch.substr(0, 1) + (octave - 1);
            });
        }
    }

    _fastShapes() {
        this.corners = [...new Array(this.staveX)].map(x => new Array(this.staveY))

        for (let y = 0; y <= this.staveY; y++) {
            for (let x = 0; x <= this.staveY; x++) {
                this.corners[x][y] = this._testBresenhamPoints(x, y);
            }
        }
    }

    // https://en.wikipedia.org/wiki/Features_from_accelerated_segment_test
    _testBresenhamPoints(x, y) {
        let count = 0;
        Bresenham_Points.forEach(xy => {
            count += Math.abs(this.px[x][y] - this.px[x + xy[0]][y + xy[1]])
                > h.bresenhamPointsThreshold;
        });
        return count;
    }

    async loadOptimalContrast() {
        const bwThreshold = 0.5;
        if (bwThreshold > 1) {
            throw new RangeError('threshold should be between 0 and 1.');
        }
        bwThreshold *= 255;

        const origImg = await Jimp.read(this.input);
        await this._resize(origImg);

        if (this.staveX === null) {
            this.staveX = this.img.bitmap.width;
        }

        const target = this.staveX * this.staveY;

        for (let contrastLevel = 0.2; contrastLevel < 0.8; contrastLevel += 0.2) {
            const img = origImg.clone();

            await img.contrast(contrastLevel).greyscale();

            this._getPixels();

            const totalAdjacentPoints = this._countAdjacentPoints(0.5);

            console.log(totalAdjacentPoints);
            console.log('-------------------');
        }
    };

    _countAdjacentPoints(threshold) {
        let totalAboveThreshold = 0;
        let totalCounted = 0;

        for (let x = 0; x < this.staveX; x++) {
            for (let y = 0; y < this.staveY; y++) {

                let counted = 0;
                let aboveThreshold = 0;

                for (let px = x - 1; px <= x + 1; px++) {
                    for (let py = y - 1; py <= y + 1; py++) {
                        if (px > 0 && px < this.staveX && py > 0 && py < this.staveY && px !== x && py !== y) {
                            // totalAboveThreshold += this.px[px][py] >= threshold ? 1 : 0;
                            totalCounted++;
                            aboveThreshold += this.px[px][py] >= threshold ? 1 : 0;
                            counted++;
                        }
                    }
                }

                // console.log(aboveThreshold, 'of', counted, aboveThreshold / counted, aboveThreshold / counted > threshold);
                totalAboveThreshold += aboveThreshold / counted > threshold;
            }
        }

        this.logger.trace('_countAdjacentPoints', totalAboveThreshold / totalCounted, ' = ' + totalAboveThreshold + '/' + totalCounted);
        return totalAboveThreshold / totalCounted;
    };

};

Horizon.MAX_VELOCITY_IN_PIXEL = 1; // 255 if using rgb

module.exports = Horizon;

const chai = require('chai');

const Horizon = require('../src/Horizon.mjs');

const logger = require('./Logger-test.mjs');
const expect = chai.expect;
chai.use(require('chai-fs'));

describe('color', () => {
    const h = new Horizon({
        input: './test/images/la.jpg',
        output: './test/output/',
        logger: logger
    });

    it('loads a colour image', async () => {
        await h.load();
        expect(h.colourImage).not.to.be.undefined;

        h._getPixels();
        expect(h.colours[0][0]).to.be.ok;
        h._linear();
        expect(h.notes[0][0]).to.be.ok;

    });

    it('note2chord', () => {
        expect(h.chords).to.be.instanceOf(Array);
        expect(h.chords.length).to.equal(h.scale.length);
    });

    it('note2chord floor', () => {
        expect(h.colour2chord(0)).to.equal('Am');
    });

    it('note2chord ceil', () => {
        expect(h.colour2chord(0.9814814814814814)).to.equal('G');
    });

    it('gets a colour pixel', () => {
        h._getHighestNotes();
        expect(h.highestNotes.length).to.be.greaterThan(0);

        // expect(h.highestNotes[0]).to.deep.equal({
        //     note: { pitch: 'G8', velocity: 32, duration: 5, startTick: 0 },
        //     colour: 0
        // });

        expect(h.highestNotes.length).to.be.greaterThan(0);
        expect(h.colours[0][0]).not.to.be.undefined;

        h._processColours();

        expect(h.highestNotes.length).to.be.greaterThan(0);
        expect(h.averageColours.length).to.be.greaterThan(0);

        expect(h.averageColours[0].pitch).to.be.an.instanceOf(Array);
        expect(h.averageColours[0].pitch).to.have.length.greaterThan(0);

        h._saveColouredHighestNotes();

        expect(h.outputMidiPath).to.match(/_coloured\.mid$/);

        expect(
            h.outputMidiPath
        ).to.be.a.file(h.outputMidiPath);
    });

});

